import { getLocation, getAbroadWeather, getDomesticWeather } from './snippets/weatherDataFetcher.js'
import { domesticReplyGenerator, abroadReplyGenerator } from './snippets/weatherFormatter.js'

function locationDataHandler (data) {
  return {
    place: [
      data.features[0].properties.geocoding.name,
      data.features[0].properties.geocoding.name.city,
      data.features[0].properties.geocoding.state,
      data.features[0].properties.geocoding.country
    ],
    placeStr () {
      return this.place.filter(Boolean).join(', ')
    },
    lat: data.features[0].geometry.coordinates[1],
    lon: data.features[0].geometry.coordinates[0]
  }
}

export default async function (ctx, agent, apiKeys) {
  const regex = /\/weather(?:\s(current|today|daily|hourly))?(\s.+)?/
  const query = regex.exec(ctx.message.text)[2] || '浦东 上海'
  const type = regex.exec(ctx.message.text)[1] || 'current'
  const locationInfo = locationDataHandler(await getLocation(query, agent))
  const country = locationInfo.place[3]
  let replyStr = ''
  if (country === '中国') {
    const weatherData = await getDomesticWeather(locationInfo, type, apiKeys.qweather)
    replyStr = domesticReplyGenerator(locationInfo, weatherData, type)
  } else {
    const weatherData = await getAbroadWeather(locationInfo, agent, apiKeys.weatherApi)
    replyStr = abroadReplyGenerator(locationInfo, weatherData, type)
  }
  await ctx.replyWithHTML(replyStr, { reply_to_message_id: ctx.message.message_id, disable_web_page_preview: true })
}
