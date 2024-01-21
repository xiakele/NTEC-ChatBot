import process from 'node:process';
import {JSONFilePreset} from 'lowdb/node';
import puppeteer from 'puppeteer';
import {Telegraf} from 'telegraf';
import chalk from 'chalk';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {CronJob} from 'cron';
import echo from './middleware/echo.js';
import {googleSearch, wikiSearch, oaldSearch} from './middleware/search.js';
import weather from './middleware/weather.js';
import bx from './middleware/bx.js';
import {getDomesticWeather} from './middleware/snippets/weather-data-fetcher.js';
import {forecastGenerator} from './middleware/snippets/weather-formatter.js';
import {reminderProcessor, checkReminder} from './middleware/reminder.js';

const configDatabase = await JSONFilePreset(new URL('config.json', import.meta.url), {});
const config = configDatabase.data;
const socksAgent = config.proxy ? new SocksProxyAgent(config.proxy) : undefined;
const bot = new Telegraf(config.token, {telegram: {agent: socksAgent}});
const command = [
	{command: 'help', description: 'get help'},
	{command: 'echo', description: 'echo!'},
	{command: 'bx', description: 'bx!'},
	{command: 'google', description: 'Google for you'},
	{command: 'wiki', description: 'Search Wikipedia'},
	{command: 'dict', description: 'OALD lookup'},
	{command: 'weather', description: 'Get weather info'},
	{command: 'reminder', description: 'Set reminders'},
];

process.on('SIGINT', () => {
	bot.stop('SIGINT');
	process.exit();
});
process.on('SIGTERM', () => {
	bot.stop('SIGTERM');
	process.exit();
});

// Start puppeteer
const browser = config.proxy
	? await puppeteer.launch({headless: 'new', args: [`--proxy-server=${config.proxy}`]})
	: await puppeteer.launch({headless: 'new'});

// Update command list
await bot.telegram.setMyCommands(command);

// Log received messages
bot.use((ctx, next) => {
	if (ctx.message.entities && ctx.message.entities.some(item => item.type === 'bot_command')) {
		console.log(`[${new Date().toISOString()}]`
			+ '[COMMAND]'
			+ `[from ${ctx.message.from.first_name}(${ctx.message.from.id}) in ${ctx.message.chat.id}]`
			+ `: '${ctx.message.text}'`);
		return next();
	}
});

// Start
bot.start(async ctx => {
	if (ctx.chat.type === 'private') {
		await ctx.reply('你好！这里是NTEC ChatBot\n输入 /help 获取指令列表');
	}
});

// Set cron job for weather
async function fetchWeather() {
	console.log(chalk.inverse('Start fetching today\'s weather'));
	const chatIds = config.autoFetchWeather.chatId;
	const dailyData = await getDomesticWeather(config.autoFetchWeather.location, 'today', config.apiKeys.qweather);
	const hourlyData = await getDomesticWeather(config.autoFetchWeather.location, 'hourly', config.apiKeys.qweather);
	const replyString = forecastGenerator(dailyData, hourlyData, config.autoFetchWeather.location.name);
	console.log(chalk.inverse('Fetch complete'));
	const queue = [];
	for (const chatId of chatIds) {
		queue.push(
			bot.telegram.sendMessage(chatId, replyString, {parse_mode: 'HTML', disable_web_page_preview: true})
				.then(message => bot.telegram.pinChatMessage(chatId, message.message_id)),
		);
	}

	await Promise.all(queue);
	console.log(chalk.inverse('Send weather info complete\n'));
}

if (config.autoFetchWeather && config.autoFetchWeather.enabled) {
	const weatherJob = new CronJob('30 0 6 * * *', fetchWeather);
	weatherJob.start();
}

// Set chronjob for reminder
const reminderJob = new CronJob('0 * * * * *', () => checkReminder(bot));
reminderJob.start();

// Help
bot.help(async ctx => {
	let content = '支持下列指令：';
	for (const item of command) {
		content += `\n/${item.command} - ${item.description}`;
	}

	await ctx.reply(content);
});

// Echo
bot.command('echo', async ctx => echo(ctx));

// Bx
bot.hears(/.*\/bx.*/, async ctx => bx(ctx));

// Error Handler
async function errorHandler(error, ctx) {
	switch (error.message) {
		case 'No Query String': {
			return ctx.reply('请输入搜索内容', {reply_to_message_id: ctx.message.message_id});
		}

		case 'No Search Results': {
			return ctx.reply('无数据', {reply_to_message_id: ctx.message.message_id});
		}

		default: {
			console.log(chalk.bgRed(`Error occurred when handling the following command:'${ctx.message.text}'\n${error}`));
			return ctx.reply('发生错误', {reply_to_message_id: ctx.message.message_id});
		}
	}
}

// Request Handler
async function requestHandler(ctx, requestFunc) {
	const page = await browser.newPage();
	await requestFunc(ctx, page)
		.catch(async error => errorHandler(error, ctx))
		.finally(async () => page.close());
}

// Google Search
bot.command('google', async ctx => requestHandler(ctx, googleSearch));

// Wikipedia Search
bot.command('wiki', async ctx => requestHandler(ctx, wikiSearch));

// OALD Search
bot.command('dict', async ctx => requestHandler(ctx, oaldSearch));

// Get weather info
bot.command('weather', async ctx => {
	await weather(ctx, socksAgent, config.apiKeys)
		.catch(async error => errorHandler(error, ctx));
});

// Reminder
bot.command('reminder', async ctx => reminderProcessor(ctx));

console.log(chalk.inverse('Bot is online.\n'));
bot.launch({allowedUpdates: ['message']});
