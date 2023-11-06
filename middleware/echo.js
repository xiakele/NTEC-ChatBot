export default async function (ctx) {
  const command = ctx.message.text
  const regex = /\/echo\s(-M\s)?(.+)/
  if (!regex.test(command)) {
    await ctx.reply('不知道该echo什么喵')
    return
  }
  await ctx.deleteMessage(ctx.message.message_id)
  const content = regex.exec(command)[2]
  if (regex.exec(command)[1] || content.includes('猫')) {
    await ctx.reply(content + '喵～')
  } else {
    await ctx.reply(content)
  }
}
