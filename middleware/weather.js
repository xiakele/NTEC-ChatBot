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
        lon: data[0].lon,
        lat: data[0].lat
      }
    })
}
export async function getWeather (location, type, agent, apiKey) {
  const current = await fetch('https://api.weatherapi.com/v1/current.json?' +
    `key=${apiKey}&q=${location.lon},${location.lat}&lang=zh`, { agent })
    .then(res => {
      if (!res.ok) {
        throw new Error('Blocked by weatherApi')
      }
      return res.json()
    })
    .then(data => {
      return {
        condition: data.current.condition.text,
        temp: data.current.temp_c,
        feelsLike: data.current.feelslike_c,
        updateTime: data.current.last_updated
      }
    })
  return { current }
}

export default async function (ctx, agent, apiKey) {
  const regex = /\/weather(?:(?:\s(hourly|daily))(?=.+))?(\s.+)?/
  const query = regex.exec(ctx.message.text)[2] || 'Pudong'
  const type = regex.exec(ctx.message.text)[1] || 'current'
  const locationInfo = await getLocation(query, agent)
  const weatherInfo = await getWeather(locationInfo, type, agent, apiKey)
  let replyStr = `<b>位置：</b>${locationInfo.name}\n\n<b>当前天气：</b>\n` +
    `天气：${weatherInfo.current.condition}\n` +
    `温度：${weatherInfo.current.temp}℃\n` +
    `体感温度：${weatherInfo.current.feelsLike}℃\n`
  if (type === 'current') {
    replyStr += `\n更新时间：${weatherInfo.current.updateTime}`
  }
  await ctx.replyWithHTML(replyStr, { reply_to_message_id: ctx.message.message_id })
}
