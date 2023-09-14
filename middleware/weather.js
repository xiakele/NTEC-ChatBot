import fetch from 'node-fetch'
import {
  formatUpdateTime,
  weatherApiDataHandler,
  domesticReplyGenerator,
  abroadReplyGenerator
} from './snippets/weatherDataHandler.js'

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

export async function getAbroadWeather (location, agent, apiKey) {
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
      return weatherApiDataHandler(data)
    })
}

export async function qweatherFetch (baseUrl, location, apiKey) {
  return await fetch(`${baseUrl}?location=${location.lon},${location.lat}&key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (data.code === '404' || data.code === '204') {
        throw new Error('No Search Results')
      }
      if (data.code !== '200') {
        throw new Error('Blocked by Qweather')
      }
      return data
    })
}
async function getDomesticWeather (location, type, apiKey) {
  const result = await qweatherFetch('https://devapi.qweather.com/v7/grid-weather/now', location, apiKey)
    .then(data => ({
      current: {
        condition: data.now.text,
        temp: data.now.temp
      }
    }))
  await qweatherFetch('https://devapi.qweather.com/v7/minutely/5m', location, apiKey)
    .then(data => {
      result.current.rainForecast = data.summary
      result.current.updateTime = formatUpdateTime(data.updateTime)
    })
  switch (type) {
    case 'today':
    case 'daily':
      await qweatherFetch('https://devapi.qweather.com/v7/grid-weather/7d', location, apiKey)
        .then(data => {
          if (new Date(data.daily[0].fxDate).getDate() < new Date().getDate()) {
            data.daily.shift()
          }
          result.daily = data.daily.map(day => ({
            date: `${new Date(day.fxDate).getMonth() + 1}/${new Date(day.fxDate).getDate()}`,
            condition: {
              day: day.textDay,
              night: day.textNight
            },
            maxTemp: day.tempMax,
            minTemp: day.tempMin,
            precipitation: day.precip
          }))
          result.daily.push(formatUpdateTime(data.updateTime))
        })
      break
    case 'hourly':
      await qweatherFetch('https://devapi.qweather.com/v7/grid-weather/24h', location, apiKey)
        .then(data => {
          result.hourly = data.hourly.map(hour => ({
            time: new Date(hour.fxTime).getHours().toString().padStart(2, '0') + ':00',
            condition: hour.text,
            temp: hour.temp,
            precipitation: hour.precip
          }))
          result.hourly.push(formatUpdateTime(data.updateTime))
        })
      break
  }
  return result
}

export default async function (ctx, agent, apiKeys) {
  const regex = /\/weather(?:\s(current|today|daily|hourly))?(\s.+)?/
  const query = regex.exec(ctx.message.text)[2] || 'Pudong'
  const type = regex.exec(ctx.message.text)[1] || 'current'
  const locationInfo = await getLocation(query, agent)
  let replyStr = ''
  if (locationInfo.place[3] === '中国') {
    const weatherInfo = await getDomesticWeather(locationInfo, type, apiKeys.qweather)
    replyStr = domesticReplyGenerator(locationInfo, weatherInfo, type)
  } else {
    const weatherInfo = await getAbroadWeather(locationInfo, agent, apiKeys.weatherApi)
    replyStr = abroadReplyGenerator(locationInfo, weatherInfo, type)
  }
  await ctx.replyWithHTML(replyStr, { reply_to_message_id: ctx.message.message_id, disable_web_page_preview: true })
}
