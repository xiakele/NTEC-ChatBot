async function reply (ctx, bxUser) {
  if (bxUser.id === ctx.from.id) {
    return ctx.reply('怎么敢拜谢自己的啊😡')
  }
  if (bxUser.username) {
    return ctx.replyWithHTML(`<a href="tg://user?id=${ctx.message.from.id}">${ctx.message.from.first_name}</a>` +
      '拜谢了' +
      `<a href="tg://user">${bxUser.username}</a>` +
      '！'
    )
  }
  return ctx.replyWithHTML(`<a href="tg://user?id=${ctx.message.from.id}">${ctx.message.from.first_name}</a>` +
      '拜谢了' +
      `<a href="tg://user?id=${bxUser.id}">${bxUser.firstName}</a>` +
      '！'
  )
}

export default async function (ctx) {
  const replyToMessage = ctx.message.reply_to_message
  let mentionEntity = null
  if (ctx.message.entities) {
    mentionEntity = ctx.message.entities.find(item => (item.type === 'mention' || item.type === 'text_mention'))
  }
  if (!(replyToMessage || mentionEntity)) {
    return await ctx.reply('不知道你想拜谢谁喵')
  }
  if (mentionEntity.type === 'text_mention') {
    const mentionUser = { id: mentionEntity.user.id, firstName: mentionEntity.user.first_name }
    return await reply(ctx, mentionUser)
  }
  if (mentionEntity.type === 'mention') {
    const mentionUser = { username: ctx.message.text.slice(mentionEntity.offset, mentionEntity.offset + mentionEntity.length) }
    return await reply(ctx, mentionUser)
  }
  const replyToUser = { id: replyToMessage.from.id, firstName: replyToMessage.from.first_name }
  return await reply(ctx, replyToUser)
}
