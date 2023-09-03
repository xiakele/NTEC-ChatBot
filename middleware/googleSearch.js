export default async function (ctx, page) {
  const regex = /\/google\s(.+)/
  const msg = {
    text: ctx.message.text,
    from: {
      id: ctx.message.from.id,
      firstName: ctx.message.from.first_name
    },
    id: ctx.message.message_id
  }
  if (!regex.test(msg.text)) {
    await ctx.reply('请输入搜索内容', { reply_to_message_id: msg.id })
    return
  }
  const query = regex.exec(msg.text)[1]
  await page.goto(`https://www.google.com/search?q=${query}`, { waitUntil: 'domcontentloaded' })
  if (page.url().includes('sorry/index')) {
    await ctx.reply('Google不让人家访问了喵！', { reply_to_message_id: msg.id })
    return
  }
  const result = await page.$eval('.LC20lb', item => {
    return { title: item.innerHTML, url: item.parentNode.href }
  })
  await ctx.replyWithHTML(`搜索结果如下：\n<a href='${result.url}'>${result.title}</a>`, { reply_to_message_id: msg.id })
}
