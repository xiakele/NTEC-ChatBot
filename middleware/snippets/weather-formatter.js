// 格式化更新时间
function formatUpdateTime(time) {
	const dateObject = new Date(time);
	return `${dateObject.getFullYear()}-${dateObject.getMonth() + 1}-${dateObject.getDate()} `
		+ `${dateObject.getHours().toString().padStart(2, '0')}:${dateObject.getMinutes().toString().padStart(2, '0')}`;
}

// 处理QWeather天气数据
function qweatherDataHandler(data) {
	const result = {
		current: {
			condition: data.current.now.text,
			temp: data.current.now.temp,
			feelsLike: data.current.now.feelsLike,
			rainForecast: data.rainForecast.summary,
			updateTime: formatUpdateTime(data.rainForecast.updateTime),
		},
		daily: {},
		hourly: {},
	};
	switch (data.type) {
		case 'daily': {
			result.daily.data = data.daily.daily.map(day => ({
				date: `${new Date(day.fxDate).getMonth() + 1}/${new Date(day.fxDate).getDate()}`,
				condition: {
					day: day.textDay,
					night: day.textNight,
				},
				maxTemp: day.tempMax,
				minTemp: day.tempMin,
				precipitation: day.precip,
			}));
			if (new Date(data.daily.daily[0].fxDate).getDate() < new Date().getDate()) {
				result.daily.data.shift();
			}

			result.daily.updateTime = formatUpdateTime(data.daily.updateTime);
			break;
		}

		case 'hourly': {
			result.hourly.data = data.hourly.hourly.map(hour => ({
				fxTime: hour.fxTime,
				time: new Date(hour.fxTime).getHours().toString().padStart(2, '0') + ':00',
				condition: hour.text,
				temp: hour.temp,
				precipitation: hour.precip,
			}));
			result.hourly.rainHours = result.hourly.data
				.filter(item => (new Date(item.fxTime).getDate() === new Date().getDate()) && (item.condition.includes('雨') || item.condition.includes('雪')))
				.map(hour => (new Date(hour.fxTime).getHours().toString().padStart(2, '0') + ':00'));
			result.hourly.updateTime = formatUpdateTime(data.hourly.updateTime);
		}

		// No default
	}

	return result;
}

// 处理WeatherAPI天气数据
function weatherApiDataHandler(data) {
	return {
		current: {
			condition: data.current.condition.text,
			temp: data.current.temp_c,
			feelsLike: data.current.feelslike_c,
		},
		daily: data.forecast.forecastday.map(item => ({
			date: `${new Date(item.date_epoch * 1000).getMonth() + 1}/${new Date(item.date_epoch * 1000).getDate()}`,
			condition: item.day.condition.text,
			maxTemp: item.day.maxtemp_c,
			minTemp: item.day.mintemp_c,
			willRain: item.day.daily_will_it_rain,
			rainProbability: item.day.daily_chance_of_rain,
			rainHours: item.hour.filter(value => value.will_it_rain)
				.map(hour => hour.time.split(' ')[1]),
		})),
		hourly: data.forecast.forecastday[0].hour.slice(new Date().getHours())
			.map(hour => ({
				time: hour.time.split(' ')[1],
				temp: hour.temp_c,
				condition: hour.condition.text,
				rainProbability: hour.chance_of_rain,
			})),
		updateTime: formatUpdateTime(data.current.last_updated_epoch * 1000),
	};
}

// 生成国内天气回复信息
export function domesticReplyGenerator(locationInfo, weatherData, type) {
	const weatherInfo = qweatherDataHandler(weatherData);
	let replyString = `<b>位置：</b>${locationInfo.placeStr()}\n\n<b>当前天气：</b>\n`
		+ `天气：${weatherInfo.current.condition}，${weatherInfo.current.rainForecast}\n`
		+ `温度：${weatherInfo.current.temp}℃\n`
		+ `体感温度：${weatherInfo.current.feelsLike}℃\n`
		+ `<b>更新时间：</b>${weatherInfo.current.updateTime}\n`;
	switch (type) {
		case 'today': {
			replyString += '\n<b>今日天气：</b>\n'
				+ `天气：${weatherInfo.daily.data[0].condition.day}/${weatherInfo.daily.data[0].condition.night}\n`
				+ `温度：${weatherInfo.daily.data[0].minTemp}~${weatherInfo.daily.data[0].maxTemp}℃\n`
				+ `降水量：${weatherInfo.daily.data[0].precipitation}mm\n`
				+ `<b>更新时间：</b>${weatherInfo.daily.updateTime}\n`;
			break;
		}

		case 'daily': {
			replyString += '\n<b>未来五天天气：</b>\n';
			for (let i = 0; i < 5; i++) {
				replyString += `${weatherInfo.daily.data[i].date}  `
					+ `${weatherInfo.daily.data[i].condition.day}/${weatherInfo.daily.data[i].condition.night}  `
					+ `${weatherInfo.daily.data[i].minTemp}~${weatherInfo.daily.data[i].maxTemp}℃  `
					+ `${weatherInfo.daily.data[i].precipitation}mm\n`;
			}

			replyString += `<b>更新时间：</b>${weatherInfo.daily.updateTime}\n`;
			break;
		}

		case 'hourly': {
			replyString += '\n<b>未来12小时天气：</b>\n';
			for (let i = 0; i < 12; i++) {
				replyString += `${weatherInfo.hourly.data[i].time}  `
					+ `${weatherInfo.hourly.data[i].condition}  `
					+ `${weatherInfo.hourly.data[i].temp}℃  `
					+ `${weatherInfo.hourly.data[i].precipitation}mm\n`;
			}

			replyString += `<b>更新时间：</b>${weatherInfo.hourly.updateTime}\n`;
		}

		// No default
	}

	replyString += '\n<b>数据来源：</b><a href="https://www.qweather.com">和风天气</a>';
	return replyString;
}

// 生成国外天气回复信息
export function abroadReplyGenerator(locationInfo, weatherData, type) {
	const weatherInfo = weatherApiDataHandler(weatherData);
	let replyString = `<b>位置：</b>${locationInfo.placeStr()}\n\n<b>当前天气：</b>\n`
		+ `天气：${weatherInfo.current.condition}\n`
		+ `温度：${weatherInfo.current.temp}℃\n`
		+ `体感温度：${weatherInfo.current.feelsLike}℃\n`;
	switch (type) {
		case 'today': {
			replyString += '\n<b>今日天气：</b>\n'
				+ `天气：${weatherInfo.daily[0].condition}\n`
				+ `温度：${weatherInfo.daily[0].minTemp}~${weatherInfo.daily[0].maxTemp}℃\n`
				+ `降雨概率：${weatherInfo.daily[0].rainProbability}%`;
			if (weatherInfo.daily[0].rainProbability) {
				replyString += weatherInfo.daily[0].willRain && weatherInfo.daily[0].rainHours.length > 0 ? `\n降雨时段：${weatherInfo.daily[0].rainHours.join(', ')}\n` : '（无显著降雨）\n';
			} else {
				replyString += '\n';
			}

			break;
		}

		case 'daily': {
			replyString += '\n<b>未来三天天气：</b>\n';
			for (const day of weatherInfo.daily) {
				replyString += `${day.date}  ${day.condition}  ${day.minTemp}~${day.maxTemp}℃  ${day.rainProbability}%\n`;
			}

			break;
		}

		case 'hourly': {
			replyString += '\n<b>未来每小时天气：</b>\n';
			for (const hour of weatherInfo.hourly) {
				replyString += `${hour.time}  ${hour.condition}  ${hour.temp}℃  ${hour.rainProbability}%\n`;
			}
		}

		// No default
	}

	replyString += `<b>更新时间：</b>${weatherInfo.updateTime}\n`
		+ '\n<b>数据来源：</b><a href="https://www.weatherapi.com/">WeatherAPI</a>';
	return replyString;
}

// 生成每日天气预报
export function forecastGenerator(dailyData, hourlyData, name) {
	const dailyInfo = qweatherDataHandler(dailyData).daily;
	const hourlyInfo = qweatherDataHandler(hourlyData).hourly;
	let replyString = `<b>今日${name}天气预报</b>\n\n`
		+ `<b>天气：</b>${dailyInfo.data[0].condition.day}/${dailyInfo.data[0].condition.night}\n`
		+ `<b>温度：</b>${dailyInfo.data[0].minTemp}~${dailyInfo.data[0].maxTemp}℃\n`
		+ `<b>降雨量：</b>${dailyInfo.data[0].precipitation}mm\n`;
	replyString += hourlyInfo.rainHours.length > 0 ? `<b>降雨时段：</b>${hourlyInfo.rainHours.join(', ')}\n\n` : '\n';
	replyString += `<b>更新时间：</b>${formatUpdateTime(dailyInfo.updateTime)}\n<b>数据来源：</b><a href="https://www.qweather.com">和风天气</a>`;
	return replyString;
}
