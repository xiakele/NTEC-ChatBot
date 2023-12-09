import fetch from 'node-fetch';

// 发送QWeather请求
async function qweatherFetch(baseUrl, location, apiKey) {
	return fetch(`${baseUrl}?location=${location.lon},${location.lat}&key=${apiKey}`)
		.then(response => response.json())
		.then(data => {
			if (data.code === '404' || data.code === '204') {
				throw new Error('No Search Results');
			}

			if (data.code !== '200') {
				throw new Error('Blocked by Qweather');
			}

			return data;
		});
}

// 获取位置信息
export async function getLocation(query, agent) {
	return fetch(` https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geocodejson&addressdetails=1`, {
		agent,
		headers: {
			'User-Agent': 'NTEC-ChatBot/1.0',
		},
	})
		.then(response => {
			if (!response.ok) {
				throw new Error('Blocked by Nominatim');
			}

			return response.json();
		})
		.then(data => {
			if (data.features.length === 0) {
				throw new Error('No Search Results');
			}

			return data;
		});
}

// 获取Qweather数据
export async function getDomesticWeather(location, type, apiKey) {
	const data = {};
	data.current = await qweatherFetch('https://devapi.qweather.com/v7/weather/now', location, apiKey);
	data.rainForecast = await qweatherFetch('https://devapi.qweather.com/v7/minutely/5m', location, apiKey);
	switch (type) {
		case 'today':
		case 'daily': {
			data.type = 'daily';
			data.daily = await qweatherFetch('https://devapi.qweather.com/v7/weather/7d', location, apiKey);
			break;
		}

		case 'hourly': {
			data.type = 'hourly';
			data.hourly = await qweatherFetch('https://devapi.qweather.com/v7/weather/24h', location, apiKey);
			break;
		}

		// No default
	}

	return data;
}

// 获取WeatherAPI数据
export async function getAbroadWeather(location, agent, apiKey) {
	return fetch('https://api.weatherapi.com/v1/forecast.json?'
    + `key=${apiKey}&q=${location.lat},${location.lon}&lang=zh&days=3`, {agent})
		.then(response => response.json())
		.then(data => {
			if (data.error) {
				if (data.error.code === 1006) {
					throw new Error('No Search Results');
				}

				throw new Error('Blocked by weatherApi');
			}

			return data;
		});
}
