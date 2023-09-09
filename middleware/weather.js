import fetch from 'node-fetch'

async function getLocation (query, agent) {
  return await fetch(` https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geocodejson&addressdetails=1`, {
    agent,
    headers: {
      'User-Agent': 'NTEC-ChatBot/1.0'
    }
  })
    .then(res => {
      if (!res.ok) {
        throw new Error('Blocked by Nominatim')
      }
      return res.json()
    })
    .then(data => {
      if (!data.features.length) {
        throw new Error('No Search Results')
      }
      return {
        place: [
          data.features[0].properties.geocoding.name,
          data.features[0].properties.geocoding.name.city,
          data.features[0].properties.geocoding.state,
          data.features[0].properties.geocoding.country
        ],
        lat: data.features[0].geometry.coordinates[1],
        lon: data.features[0].geometry.coordinates[0]
      }
    })
}

export async function getWeather (location, agent, apiKey) {
  return await fetch('https://api.weatherapi.com/v1/forecast.json?' +
    `key=${apiKey}&q=${location.lat},${location.lon}&lang=zh&days=3`, { agent })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        if (data.error.code === 1006) {
          throw new Error('No Search Results')
        }
        throw new Error('Blocked by weatherApi')
      }
      return weatherDataHandler(data)
    })
}

function weatherDataHandler (data) {
  const time = new Date(data.current.last_updated_epoch * 1000)
  const timeStr = `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()} ` +
        `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
  return {
    current: {
      condition: data.current.condition.text,
      temp: data.current.temp_c,
      feelsLike: data.current.feelslike_c
    },
    daily: data.forecast.forecastday.map(item => {
      return {
        date: `${new Date(item.date_epoch * 1000).getMonth() + 1}/${new Date(item.date_epoch * 1000).getDate()}`,
        condition: item.day.condition.text,
        maxTemp: item.day.maxtemp_c,
        minTemp: item.day.mintemp_c,
        willRain: item.day.daily_will_it_rain,
        rainProbability: item.day.daily_chance_of_rain,
        rainHours: item.hour.filter(val => val.will_it_rain)
          .map(hour => hour.time.split(' ')[1])
      }
    }),
    hourly: data.forecast.forecastday[0].hour.slice(new Date().getHours())
      .map(hour => {
        return {
          time: hour.time.split(' ')[1],
          temp: hour.temp_c,
          condition: hour.condition.text,
          rainProbability: hour.chance_of_rain
        }
      }),
    updateTime: timeStr
  }
}

export default async function (ctx, agent, apiKey) {
  const regex = /\/weather(?:\s(current|today|daily|hourly))?(\s.+)?/
  const query = regex.exec(ctx.message.text)[2] || 'Pudong'
  const type = regex.exec(ctx.message.text)[1] || 'current'
  const locationInfo = await getLocation(query, agent)
  const weatherInfo = await getWeather(locationInfo, agent, apiKey)
  let replyStr = `<b>位置：</b>${locationInfo.place.filter(Boolean).join(', ')}\n\n<b>当前天气：</b>\n` +
    `天气：${weatherInfo.current.condition}\n` +
    `温度：${weatherInfo.current.temp}℃\n` +
    `体感温度：${weatherInfo.current.feelsLike}℃\n`
  switch (type) {
    case 'today':
      replyStr += '\n<b>今日天气：</b>\n' +
        `天气：${weatherInfo.daily[0].condition}\n` +
        `温度：${weatherInfo.daily[0].minTemp}~${weatherInfo.daily[0].maxTemp}℃\n` +
        `降雨概率：${weatherInfo.daily[0].rainProbability}%`
      if (weatherInfo.daily[0].rainProbability) {
        if (weatherInfo.daily[0].willRain && weatherInfo.daily[0].rainHours.length) {
          replyStr += `\n降雨时段：${weatherInfo.daily[0].rainHours.join(', ')}\n`
        } else {
          replyStr += '（无显著降雨）\n'
        }
      } else {
        replyStr += '\n'
      }
      break
    case 'daily':
      replyStr += '\n<b>未来三天天气：</b>\n'
      for (const day of weatherInfo.daily) {
        replyStr += `${day.date}  ${day.condition}  ${day.minTemp}~${day.maxTemp}℃  ${day.rainProbability}%\n`
      }
      break
    case 'hourly':
      replyStr += '\n<b>未来每小时天气：</b>\n'
      for (const hour of weatherInfo.hourly) {
        replyStr += `${hour.time}  ${hour.condition}  ${hour.temp}℃  ${hour.rainProbability}%\n`
      }
  }
  replyStr += `\n<b>更新时间：</b>${weatherInfo.updateTime}`
  await ctx.replyWithHTML(replyStr, { reply_to_message_id: ctx.message.message_id })
}
