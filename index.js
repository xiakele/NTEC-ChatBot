const puppeteer = require('puppeteer')
const { Telegraf } = require('telegraf')
const path = require('path')
const chalk = require('chalk')
const { SocksProxyAgent } = require('socks-proxy-agent')
const config = require(path.join(__dirname, '/config.json'))
const bot = config.proxy
  ? new Telegraf(config.token, { telegram: { agent: new SocksProxyAgent(config.proxy) } })
  : new Telegraf(config.token)
const googleSearch = require(path.join(__dirname, '/middleware/googleSearch'))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

async function start () {
  const browser = await puppeteer.launch({ headless: 'new' })

  // Google Search
  bot.telegram.setMyCommands([{ command: 'google', description: 'Google for you' }])
  bot.command('google', async (ctx) => await googleSearch(ctx, browser))

  console.log(chalk.inverse('Bot is online.'))
  bot.launch({ dropPendingUpdates: true })
}

start()
