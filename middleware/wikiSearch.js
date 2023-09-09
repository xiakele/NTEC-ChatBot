export default async function (ctx, page) {
  const regex = /\/wiki\s(.+)/
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
  await page.goto(`https://zh.wikipedia.org/w/index.php?fulltext=1&search=${query}`, { waitUntil: 'domcontentloaded' })
  const result = await page.$eval('.mw-search-result-heading > a', item => {
    return { title: item.title, url: item.href }
  })
  await page.goto(result.url.replace('/wiki/', '/zh-cn/'), { waitUntil: 'domcontentloaded' })
  const simpResult = { title: await page.$eval('.mw-page-title-main', item => item.innerHTML), url: page.url() }
  await ctx.replyWithHTML(`搜索结果如下：\n中文：<a href='${result.url}'>${result.title}</a>\n简中：<a href='${simpResult.url}'>${simpResult.title}</a>`, { reply_to_message_id: msg.id })
}
