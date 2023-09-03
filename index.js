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

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

// start puppeteer
const browser = config.proxy
  ? await puppeteer.launch({ headless: 'new', args: [`--proxy-server=${config.proxy}`] })
  : await puppeteer.launch({ headless: 'new' })

// update command list
await bot.telegram.setMyCommands(command)

// log received messages
bot.use((ctx, next) => {
  console.log(`${ctx.message.text.startsWith('/') ? '[COMMAND]' : '[MESSAGE]'} ` +
      `[from ${ctx.message.from.first_name}(${ctx.message.from.id})]` +
      `: '${ctx.message.text}'`)
  return next()
})

// start
bot.start(async ctx => {
  if (ctx.chat.type === 'private') {
    await ctx.reply('你好！这里是NTEC ChatBot\n输入 /help 获取指令列表')
  }
})

// set cron job for weather
// if (config.autoFetchWeather) {
//   job('0 0 6 * * *', () => console.log('test'), null, true)
// }

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
      console.log(chalk.bgRed(`Error occured when handling the following command:'${ctx.message.text}'\n${err}`))
      await ctx.reply('发生错误', { reply_to_message_id: ctx.message.message_id })
    })
})

console.log(chalk.inverse('Bot is online.\n'))
bot.launch()
