import puppeteer from 'puppeteer'
import { Telegraf } from 'telegraf'
import chalk from 'chalk'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { readFile } from 'node:fs/promises'
import { job } from 'cron'

import echo from './middleware/echo.js'
import { googleSearch, wikiSearch } from './middleware/search.js'
import weather from './middleware/weather.js'
import bx from './middleware/bx.js'
import { getDomesticWeather } from './middleware/snippets/weatherDataFetcher.js'
import { forecastGenerator } from './middleware/snippets/weatherFormatter.js'

const config = JSON.parse(await readFile(new URL('config.json', import.meta.url)))
const socksAgent = config.proxy ? new SocksProxyAgent(config.proxy) : undefined
const bot = new Telegraf(config.token, { telegram: { agent: socksAgent } })
const command = [
  { command: 'help', description: 'get help' },
  { command: 'echo', description: 'echo!' },
  { command: 'bx', description: 'bx!' },
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
  if (ctx.message.entities && ctx.message.entities.find(item => item.type === 'bot_command')) {
    console.log(`[${new Date().toISOString()}]` +
      '[COMMAND]' +
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
  const dailyData = await getDomesticWeather(config.autoFetchWeather.location, 'today', config.apiKeys.qweather)
  const hourlyData = await getDomesticWeather(config.autoFetchWeather.location, 'hourly', config.apiKeys.qweather)
  const replyStr = forecastGenerator(dailyData, hourlyData, config.autoFetchWeather.location.name)
  console.log(chalk.inverse('Fetch complete'))
  for (const chatId of chatIds) {
    const message = await bot.telegram.sendMessage(chatId, replyStr, { parse_mode: 'HTML', disable_web_page_preview: true })
    await bot.telegram.pinChatMessage(chatId, message.message_id)
  }
  console.log(chalk.inverse('Send weather info complete\n'))
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

// bx
bot.hears(/.*\/bx.*/, async ctx => await bx(ctx))

// Error Handler
async function errHandler (err, ctx) {
  switch (err.message) {
    case 'No Query String':
      return await ctx.reply('请输入搜索内容', { reply_to_message_id: ctx.message.message_id })
    case 'No Search Results':
      return await ctx.reply('无数据', { reply_to_message_id: ctx.message.message_id })
    default:
      console.log(chalk.bgRed(`Error occurred when handling the following command:'${ctx.message.text}'\n${err}`))
      return await ctx.reply('发生错误', { reply_to_message_id: ctx.message.message_id })
  }
}

// Request Handler
async function requestHandler (ctx, requestFunc) {
  const page = await browser.newPage()
  await requestFunc(ctx, page)
    .catch(async err => errHandler(err, ctx))
    .finally(async () => await page.close())
}

// Google Search
bot.command('google', async ctx => await requestHandler(ctx, googleSearch))

// Wikipedia Search
bot.command('wiki', async ctx => await requestHandler(ctx, wikiSearch))

// Get weather info
bot.command('weather', async ctx => {
  await weather(ctx, socksAgent, config.apiKeys)
    .catch(async err => errHandler(err, ctx))
})

console.log(chalk.inverse('Bot is online.\n'))
bot.launch({ allowedUpdates: ['message'] })
