module.exports = async function echo (ctx) {
  const command = ctx.message.text
  const regex = /\/echo\s(.+)/
  if (!regex.test(command)) {
    ctx.reply('不知道该echo什么喵')
    return
  }
  const content = regex.exec(command)[1]
  ctx.reply(content)
}
