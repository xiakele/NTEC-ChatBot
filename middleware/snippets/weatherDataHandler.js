export function formatUpdateTime (time) {
  const dateObj = new Date(time)
  return `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()} ` +
        `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`
}

export function weatherApiDataHandler (data) {
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
    updateTime: formatUpdateTime(data.current.last_updated_epoch * 1000)
  }
}

export function domesticReplyGenerator (locationInfo, weatherInfo, type) {
  let replyStr = `<b>位置：</b>${locationInfo.place.filter(Boolean).join(', ')}\n\n<b>当前天气：</b>\n` +
    `天气：${weatherInfo.current.condition}\n` +
    `温度：${weatherInfo.current.temp}℃\n` +
    `未来两小时：${weatherInfo.current.rainForecast}\n` +
    `<b>更新时间：</b>${weatherInfo.current.updateTime}\n`
  switch (type) {
    case 'today':
      replyStr += '\n<b>今日天气：</b>\n' +
        `天气：${weatherInfo.daily[0].condition.day}/${weatherInfo.daily[0].condition.night}\n` +
        `温度：${weatherInfo.daily[0].minTemp}~${weatherInfo.daily[0].maxTemp}℃\n` +
        `降水量：${weatherInfo.daily[0].precipitation}mm\n` +
        `<b>更新时间：</b>${weatherInfo.daily.pop()}\n`
      break
    case 'daily':
      replyStr += '\n<b>未来五天天气：</b>\n'
      for (let i = 0; i < 5; i++) {
        replyStr += `${weatherInfo.daily[i].date}  ` +
          `${weatherInfo.daily[i].condition.day}/${weatherInfo.daily[i].condition.night}  ` +
          `${weatherInfo.daily[i].minTemp}~${weatherInfo.daily[i].maxTemp}℃  ` +
          `${weatherInfo.daily[i].precipitation}mm\n`
      }
      replyStr += `<b>更新时间：</b>${weatherInfo.daily.pop()}\n`
      break
    case 'hourly':
      replyStr += '\n<b>未来12小时天气：</b>\n'
      for (let i = 0; i < 12; i++) {
        replyStr += `${weatherInfo.hourly[i].time}  ` +
          `${weatherInfo.hourly[i].condition}  ` +
          `${weatherInfo.hourly[i].temp}℃  ` +
          `${weatherInfo.hourly[i].precipitation}mm\n`
      }
      replyStr += `<b>更新时间：</b>${weatherInfo.hourly.pop()}\n`
  }
  replyStr += '\n<b>数据来源：</b><a href="https://www.qweather.com">和风天气</a>'
  return replyStr
}

export function abroadReplyGenerator (locationInfo, weatherInfo, type) {
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
  replyStr += `<b>更新时间：</b>${weatherInfo.updateTime}\n` +
    '\n<b>数据来源：</b><a href="https://www.weatherapi.com/">WeatherAPI</a>'
  return replyStr
}

export function fetchDataHandler (dayInfo, hourlyInfo, name) {
  if (new Date(dayInfo.daily[0].fxDate).getDate() < new Date().getDate()) {
    dayInfo.daily.shift()
  }
  let replyStr = `<b>今日${name}天气预报</b>\n\n` +
    `<b>天气：</b>${dayInfo.daily[0].textDay}/${dayInfo.daily[0].textNight}\n` +
    `<b>温度：</b>${dayInfo.daily[0].tempMin}~${dayInfo.daily[0].tempMax}℃\n` +
    `<b>降雨量：</b>${dayInfo.daily[0].precip}mm\n`
  const rainHours = hourlyInfo.hourly
    .filter(item => (new Date(item.fxTime).getDate() === new Date().getDate()) && (item.text.includes('雨') || item.text.includes('雪')))
    .map(hour => (new Date(hour.fxTime).getHours().toString().padStart(2, '0') + ':00'))
  replyStr += rainHours.length ? `<b>降雨时段：</b>${rainHours.join(', ')}\n` : '\n'
  replyStr += `\n<b>更新时间：</b>${formatUpdateTime(dayInfo.updateTime)}\n<b>数据来源：</b><a href="https://www.qweather.com">和风天气</a>`
  return replyStr
}
