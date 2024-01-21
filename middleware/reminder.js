import {JSONFilePreset} from 'lowdb/node';

export const database = await JSONFilePreset(new URL('../reminders.json', import.meta.url), {});

async function reply(ctx, content) {
	return ctx.replyWithHTML(content, {reply_to_message_id: ctx.message.message_id});
}

export async function reminderProcessor(ctx) {
	if (ctx.message.text.includes('/reminder list')) {
		return listReminder(ctx);
	}

	if (ctx.message.text.includes('/reminder remove')) {
		return removeReminder(ctx);
	}

	setReminder(ctx);
}

async function setReminder(ctx) {
	const rawMessage = ctx.message.text;
	const regex = /\/reminder\s(?:(?:(\+)([1-9]\d*)([mhd]))|(\S+))\s(.+)/;
	const result = regex.exec(rawMessage);
	if (!result) {
		return reply(ctx, '请检查请求内容喵！');
	}

	const userId = ctx.message.from.id;
	const data = {
		firstName: ctx.from.first_name,
		chatId: ctx.chat.id,
	};
	data.time = {isRelative: Boolean(result[1])};
	data.content = result[5];
	if (data.time.isRelative) {
		data.time.unit = result[3];
		switch (result[3]) {
			case 'h': {
				data.time.timestamp = result[2] * 1000 * 60 * 60;
				break;
			}

			case 'd': {
				data.time.timestamp = result[2] * 1000 * 60 * 60 * 24;
				break;
			}

			default: {
				data.time.timestamp = result[2] * 1000 * 60;
				break;
			}
		}

		const target = new Date(Date.now() + data.time.timestamp);
		data.time.target = new Date(Math.round(target.getTime() / (60 * 1000)) * (60 * 1000)).getTime();
	} else {
		data.time.target = new Date(result[4]).getTime();
		if (!data.time.target.valueOf()) {
			return reply(ctx, '请检查输入的时间喵！');
		}
	}

	data.time.humanReadable = new Date(data.time.target).toLocaleString().slice(0, -3);
	await database.update(reminders => {
		if (reminders[userId]) {
			reminders[userId].push(data);
		} else {
			reminders[userId] = [data];
		}
	});
	return reply(ctx, '已成功设置提醒！\n'
		+ `时间：${data.time.humanReadable}\n`
		+ `内容：${data.content}`,
	);
}

async function listReminder(ctx) {
	let replyText = `<a href="tg://user?id=${ctx.message.from.id}">${ctx.message.from.first_name}</a>，`
	+ '您的提醒如下：';
	const reminders = database.data[ctx.message.from.id];
	if (!reminders || reminders.length === 0) {
		return reply(ctx, '您还没有添加提醒喵！');
	}

	for (const [index, reminder] of reminders.entries()) {
		replyText += `\n${index + 1}. ${reminder.time.humanReadable}\n`
			+ `内容：${reminder.content}\n`;
	}

	return reply(ctx, replyText);
}

async function removeReminder(ctx) {
	const regex = /\/reminder\sremove\s(\d+|all)/;
	const result = regex.exec(ctx.message.text);
	if (!result || !result[1]) {
		return reply(ctx, '请检查请求内容喵！');
	}

	const reminders = database.data[ctx.message.from.id];
	if (!reminders || reminders.length === 0) {
		return reply(ctx, '您还没有添加提醒喵！');
	}

	if (result[1] === 'all') {
		database.data[ctx.message.from.id] = [];
		await database.write();
		return reply(ctx, '已删除所有提醒！');
	}

	const number = result[1];
	if (number < 1 || number > reminders.length) {
		return reply(ctx, '没有该提醒喵！');
	}

	database.update(data => data[ctx.message.from.id].splice(number - 1, 1));
	return reply(ctx, '已删除提醒！');
}

export async function checkReminder(bot) {
	return database.update(data => {
		for (const user of Object.keys(data)) {
			for (let i = data[user].length - 1; i >= 0; i--) {
				const reminder = data[user][i];
				if (reminder.time.target <= Date.now()) {
					bot.telegram.sendMessage(reminder.chatId, `<a href="tg://user?id=${reminder.userId}">${reminder.firstName}</a>，`
				+ '您有一条提醒：\n'
				+ `时间：${reminder.time.humanReadable}\n`
				+ `内容：${reminder.content}`,
					{parse_mode: 'HTML'},
					);
					data[user].splice(i, 1);
				}
			}
		}
	});
}
