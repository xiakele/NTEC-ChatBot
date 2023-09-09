import puppeteer from 'puppeteer'
import { Telegraf } from 'telegraf'
import chalk from 'chalk'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { readFile } from 'node:fs/promises'
import { job } from 'cron'

import echo from './middleware/echo.js'
import googleSearch from './middleware/googleSearch.js'
import wikiSearch from './middleware/wikiSearch.js'
import weather, { getWeather } from './middleware/weather.js'

const config = JSON.parse(await readFile(new URL('config.json', import.meta.url)))
const socksAgent = config.proxy ? new SocksProxyAgent(config.proxy) : undefined
const bot = new Telegraf(config.token, { telegram: { agent: socksAgent } })
const command = [
  { command: 'help', description: 'get help' },
  { command: 'echo', description: 'echo!' },
  { command: 'google', description: 'Google for you' },
  { command: 'wiki', description: 'Search Wikipedia' },
  { command: 'weather', description: 'Get weather info' }
]

process.on('SIGINT', () => {
  bot.stop('SIGINT')
  process.exit()
})
process.on('SIGTERM', () => {
  bot.stop('SIGTERM')
  process.exit()
})

// start puppeteer
const browser = config.proxy
  ? await puppeteer.launch({ headless: 'new', args: [`--proxy-server=${config.proxy}`] })
  : await puppeteer.launch({ headless: 'new' })

// update command list
await bot.telegram.setMyCommands(command)

// log received messages
bot.use((ctx, next) => {
  if (ctx.message.text && ctx.message.text.startsWith('/')) {
    console.log('[COMMAND]' +
      `[from ${ctx.message.from.first_name}(${ctx.message.from.id}) in ${ctx.message.chat.id}]` +
      `: '${ctx.message.text}'`)
    return next()
  }
})

// start
bot.start(async ctx => {
  if (ctx.chat.type === 'private') {
    await ctx.reply('你好！这里是NTEC ChatBot\n输入 /help 获取指令列表')
  }
})

// set cron job for weather
async function fetchWeather () {
  console.log(chalk.inverse('Start fetching today\'s weather'))
  const chatIds = config.autoFetchWeather.chatId
  await getWeather(config.autoFetchWeather.location, socksAgent, config.apiKeys.weather)
    .then(async weatherInfo => {
      let replyStr = `<b>今日${config.autoFetchWeather.location.name}天气预报</b>\n\n` +
        `<b>天气：</b>${weatherInfo.daily[0].condition}\n` +
        `<b>温度：</b>${weatherInfo.daily[0].minTemp}~${weatherInfo.daily[0].maxTemp}℃\n` +
        `<b>降雨概率：</b>${weatherInfo.daily[0].rainProbability}%`
      if (weatherInfo.daily[0].rainProbability) {
        if (weatherInfo.daily[0].willRain && weatherInfo.daily[0].rainHours.length) {
          replyStr += `\n<b>降雨时段：</b>${weatherInfo.daily[0].rainHours.join(', ')}\n`
        } else {
          replyStr += '（无显著降雨）\n'
        }
      } else {
        replyStr += '\n'
      }
      replyStr += `\n<b>更新时间：</b>${weatherInfo.updateTime}`
      console.log(chalk.inverse('Fetch complete'))
      chatIds.forEach(async chatId => {
        const message = await bot.telegram.sendMessage(chatId, replyStr, { parse_mode: 'HTML' })
        await bot.telegram.pinChatMessage(chatId, message.message_id)
      })
      console.log(chalk.inverse('Send weather info complete\n'))
    })
    .catch(async err => console.log(chalk.bgRed(`Error occured when fetching weather\n${err}`)))
}
if (config.autoFetchWeather && config.autoFetchWeather.enabled) {
  job('30 0 6 * * *', fetchWeather, null, true)
}

// help
bot.help(async ctx => {
  let content = '支持下列指令：'
  command.forEach(item => {
    content += `\n/${item.command} - ${item.description}`
  })
  await ctx.reply(content)
})

// echo
bot.command('echo', async ctx => await echo(ctx))

// Request Handler
async function requestHandler (ctx, requestFunc) {
  const page = await browser.newPage()
  await requestFunc(ctx, page)
    .catch(async err => {
      console.log(chalk.bgRed(`Error occured when handling the following command:'${ctx.message.text}'\n${err}`))
      await ctx.reply('发生错误', { reply_to_message_id: ctx.message.message_id })
    })
    .finally(async () => await page.close())
}

// Google Search
bot.command('google', async ctx => await requestHandler(ctx, googleSearch))

// Wikipedia Search
bot.command('wiki', async ctx => await requestHandler(ctx, wikiSearch))

// Get weather info
bot.command('weather', async ctx => {
  await weather(ctx, socksAgent, config.apiKeys.weather)
    .catch(async err => {
      if (err.message === 'No Search Results') {
        return await ctx.reply('无数据', { reply_to_message_id: ctx.message.message_id })
      }
      console.log(chalk.bgRed(`Error occured when handling the following command:'${ctx.message.text}'\n${err}`))
      return await ctx.reply('发生错误', { reply_to_message_id: ctx.message.message_id })
    })
})

console.log(chalk.inverse('Bot is online.\n'))
bot.launch({ allowedUpdates: ['message'] })
