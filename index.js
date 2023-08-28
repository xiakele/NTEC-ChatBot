const puppeteer = require('puppeteer')
const { Telegraf } = require('telegraf')
const path = require('path')
const chalk = require('chalk')
const { SocksProxyAgent } = require('socks-proxy-agent')
const config = require(path.join(__dirname, '/config.json'))
const bot = config.proxy
  ? new Telegraf(config.token, { telegram: { agent: new SocksProxyAgent(config.proxy) } })
  : new Telegraf(config.token)
const echo = require(path.join(__dirname, '/middleware/echo'))
const googleSearch = require(path.join(__dirname, '/middleware/googleSearch'))
const wikiSearch = require(path.join(__dirname, '/middleware/wikiSearch'))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

async function start () {
  const browser = config.proxy
    ? await puppeteer.launch({ headless: 'new', args: [`--proxy-server=${config.proxy}`] })
    : await puppeteer.launch({ headless: 'new' })

  // update command list
  bot.telegram.setMyCommands([
    { command: 'echo', description: 'echo!' },
    { command: 'google', description: 'Google for you' },
    { command: 'wiki', description: 'Search Wikipedia' }
  ])

  // echo
  bot.command('echo', async ctx => {
    console.log(`[COMMAND] [from ${ctx.message.from.first_name}(${ctx.message.from.id})]` +
      `: '${ctx.message.text}'`)
    await echo(ctx)
  })

  // Search Handler
  async function searchHandler (ctx, searchFunc) {
    console.log(`[COMMAND] [from ${ctx.message.from.first_name}(${ctx.message.from.id})]` +
      `: '${ctx.message.text}'`)
    const page = await browser.newPage()
    await searchFunc(ctx, page)
      .catch(err => {
        console.log(chalk.bgRed(`Error occured when handling the following command:'${ctx.message.text}'\n${err}`))
        ctx.reply('发生错误', { reply_to_message_id: ctx.message.message_id })
      })
      .finally(() => page.close())
  }

  // Google Search
  bot.command('google', async ctx => searchHandler(ctx, googleSearch))

  // Wikipedia Search
  bot.command('wiki', async ctx => searchHandler(ctx, wikiSearch))

  console.log(chalk.inverse('Bot is online.\n'))
  bot.launch()
}

start()
