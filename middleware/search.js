function queryExtractor(regex, messageTxt) {
	if (!regex.test(messageTxt)) {
		throw new Error('No Query String');
	}

	return regex.exec(messageTxt)[1];
}

export async function googleSearch(ctx, page) {
	const query = queryExtractor(/\/google\s(.+)/, ctx.message.text);
	await page.goto(`https://www.google.com/search?q=${query}`, {waitUntil: 'domcontentloaded'});
	if (page.url().includes('sorry/index')) {
		await ctx.reply('Google不让人家访问了喵！', {reply_to_message_id: ctx.message.message_id});
		return;
	}

	const result = await page.$eval('.LC20lb', item => ({title: item.innerHTML, url: item.parentNode.href}));
	await ctx.replyWithHTML(`搜索结果如下：\n<a href='${result.url}'>${result.title}</a>`, {reply_to_message_id: ctx.message.message_id});
}

export async function wikiSearch(ctx, page) {
	const query = queryExtractor(/\/wiki\s(.+)/, ctx.message.text);
	await page.goto(`https://zh.wikipedia.org/w/index.php?fulltext=1&search=${query}`, {waitUntil: 'domcontentloaded'});
	const result = await page.$eval('.mw-search-result-heading > a', item => ({title: item.title, url: item.href}));
	await page.goto(result.url.replace('/wiki/', '/zh-cn/'), {waitUntil: 'domcontentloaded'});
	const title = await page.title();
	const simpResult = {title: title.match(/(.*) - 维基百科/)[1], url: page.url()};
	await ctx.replyWithHTML(`搜索结果如下：\n中文：<a href='${result.url}'>${result.title}</a>\n简中：<a href='${simpResult.url}'>${simpResult.title}</a>`, {reply_to_message_id: ctx.message.message_id});
}

export async function oaldSearch(ctx, page) {
	const query = queryExtractor(/\/dict\s(.+)/, ctx.message.text);
	await page.goto(`https://www.oxfordlearnersdictionaries.com/search/english/?q=${query}`, {waitUntil: 'domcontentloaded'});
	const title = await page.title();
	if (title.includes('Did you spell it correctly?')) {
		if (await page.$('.didyoumean+.result-list')) {
			const correction = await page.$eval('.didyoumean+.result-list li a', a => ({href: a.href, word: a.textContent}));
			await ctx.replyWithHTML(`请检查拼写错误喵！\n您是否想查找：<a href="${correction.href}">${correction.word}</a>`, {reply_to_message_id: ctx.message.message_id});
			return;
		}

		await ctx.reply('请检查拼写错误喵！', {reply_to_message_id: ctx.message.message_id});
		return;
	}

	const word = await page.$eval('.headword', headword => headword.textContent);
	const phon = await page.$eval('.phons_n_am .phon', phon => phon.textContent);
	const senses = await page.$$eval('.senses_multiple .def,.sense_single .def', senses =>
		senses.map((sense, index) =>
			`<b>${index + 1}.</b> ${sense.textContent}`));
	const strippedSenses = (senses.length <= 3) ? senses : [...senses.slice(0, 3), '...'];
	await ctx.replyWithHTML(
		`<b><a href="${page.url()}">${word}</a> ${phon}</b>\n\n`
    + strippedSenses.join('\n'),
		{reply_to_message_id: ctx.message.message_id},
	);
}
