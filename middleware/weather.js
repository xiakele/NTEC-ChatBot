import fetch from 'node-fetch'

async function getLocation (query, agent) {
  return await fetch(` https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2`, {
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
      if (!data.length) {
        throw new Error('No Search Results')
      }
      return {
        name: data[0].name,
        lat: data[0].lat,
        lon: data[0].lon
      }
    })
}
export async function getWeather (location, type, agent, apiKey) {
  const current = await fetch('https://api.weatherapi.com/v1/current.json?' +
    `key=${apiKey}&q=${location.lat},${location.lon}&lang=zh`, { agent })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        if (data.error.code === 1006) {
          throw new Error('No Search Results')
        }
        throw new Error('Blocked by weatherApi')
      }
      const time = new Date(data.current.last_updated_epoch * 1000)
      const timeStr = `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()} ` +
        `${time.getHours()}:${time.getMinutes()}`
      return {
        condition: data.current.condition.text,
        temp: data.current.temp_c,
        feelsLike: data.current.feelslike_c,
        updateTime: timeStr
      }
    })
  const result = { current }
  if (type === 'today') {
    const today = await fetch('https://api.weatherapi.com/v1/forecast.json?' +
      `key=${apiKey}&q=${location.lat},${location.lon}&lang=zh&days=1`, { agent })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          if (data.error.code === 1006) {
            throw new Error('No Search Results')
          }
          throw new Error('Blocked by weatherApi')
        }
        return {
          condition: data.forecast.forecastday[0].day.condition.text,
          maxTemp: data.forecast.forecastday[0].day.maxtemp_c,
          minTemp: data.forecast.forecastday[0].day.mintemp_c,
          rainProbability: data.forecast.forecastday[0].day.daily_chance_of_rain
        }
      })
    result.today = today
  }
  return result
}

export default async function (ctx, agent, apiKey) {
  const regex = /\/weather(?:(?:\s(today|hourly|daily))(?=.+))?(\s.+)?/
  const query = regex.exec(ctx.message.text)[2] || 'Pudong'
  const type = regex.exec(ctx.message.text)[1] || 'current'
  const locationInfo = await getLocation(query, agent)
  const weatherInfo = await getWeather(locationInfo, type, agent, apiKey)
  let replyStr = `<b>位置：</b>${locationInfo.name}\n\n<b>当前天气：</b>\n` +
    `天气：${weatherInfo.current.condition}\n` +
    `温度：${weatherInfo.current.temp}℃\n` +
    `体感温度：${weatherInfo.current.feelsLike}℃\n`
  replyStr += `\n<b>更新时间：</b>${weatherInfo.current.updateTime}`
  await ctx.replyWithHTML(replyStr, { reply_to_message_id: ctx.message.message_id })
}
