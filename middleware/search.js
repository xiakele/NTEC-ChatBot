function queryExtractor (regex, msgTxt) {
  if (!regex.test(msgTxt)) {
    throw new Error('No query string')
  }
  return regex.exec(msgTxt)[1]
}

export async function googleSearch (ctx, page) {
  const regex = /\/google\s(.+)/
  const query = queryExtractor(regex, ctx.message.text)
  await page.goto(`https://www.google.com/search?q=${query}`, { waitUntil: 'domcontentloaded' })
  if (page.url().includes('sorry/index')) {
    await ctx.reply('Google不让人家访问了喵！', { reply_to_message_id: ctx.message.message_id })
    return
  }
  const result = await page.$eval('.LC20lb', item => {
    return { title: item.innerHTML, url: item.parentNode.href }
  })
  await ctx.replyWithHTML(`搜索结果如下：\n<a href='${result.url}'>${result.title}</a>`, { reply_to_message_id: ctx.message.message_id })
}

export async function wikiSearch (ctx, page) {
  const regex = /\/wiki\s(.+)/
  const query = queryExtractor(regex, ctx.message.text)
  await page.goto(`https://zh.wikipedia.org/w/index.php?fulltext=1&search=${query}`, { waitUntil: 'domcontentloaded' })
  const result = await page.$eval('.mw-search-result-heading > a', item => {
    return { title: item.title, url: item.href }
  })
  await page.goto(result.url.replace('/wiki/', '/zh-cn/'), { waitUntil: 'domcontentloaded' })
  const simpResult = { title: (await page.title()).match(/(.*) - 维基百科/)[1], url: page.url() }
  await ctx.replyWithHTML(`搜索结果如下：\n中文：<a href='${result.url}'>${result.title}</a>\n简中：<a href='${simpResult.url}'>${simpResult.title}</a>`, { reply_to_message_id: ctx.message.message_id })
}
