const puppeteer = require('puppeteer')
const { Telegraf } = require('telegraf')
const path = require('path')
const chalk = require('chalk')
const { SocksProxyAgent } = require('socks-proxy-agent')
const config = require(path.join(__dirname, '/config.json'))
const socksAgent = config.proxy ? new SocksProxyAgent(config.proxy) : undefined
const bot = new Telegraf(config.token, { telegram: { agent: socksAgent } })
const command = [
  { command: 'help', description: 'get help' },
  { command: 'echo', description: 'echo!' },
  { command: 'google', description: 'Google for you' },
  { command: 'wiki', description: 'Search Wikipedia' }
]
const echo = require(path.join(__dirname, '/middleware/echo'))
const googleSearch = require(path.join(__dirname, '/middleware/googleSearch'))
const wikiSearch = require(path.join(__dirname, '/middleware/wikiSearch'))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

async function start () {
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

  console.log(chalk.inverse('Bot is online.\n'))
  bot.launch()
}

start()
