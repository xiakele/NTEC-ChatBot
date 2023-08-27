module.exports = async function echo (ctx) {
  const command = ctx.message.text
  const regex = /\/echo\s(-M\s)?(.+)/
  if (!regex.test(command)) {
    ctx.reply('不知道该echo什么喵')
    return
  }
  const content = regex.exec(command)[2]
  if (regex.exec(command)[1] || content.includes('猫')) {
    ctx.reply(content + '喵～')
  } else {
    ctx.reply(content)
  }
}
