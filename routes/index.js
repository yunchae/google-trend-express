const express = require('express');
const router = express.Router();
const googleTrends = require('google-trends-api')
const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo")

router.post('/weekly', async function(req, res, next) {
  const body = req.body

  const keywords = body.keywords
  const start = body.startdate.split('.')
  const end = body.enddate.split('.')
  const beforeYear = body.beforeYear
  const beforeMonth = body.beforeMonth
  const beforeDay = body.beforeDay

  let startDate = ''
  let endDate = ''

  if (beforeYear || beforeMonth || beforeDay) {
    startDate = makeTodayDate()
    endDate = makeTodayDate()

    if (beforeYear > 0 ) startDate.setFullYear(startDate.getFullYear() - beforeYear)
    if (beforeMonth > 0 ) startDate.setMonth(startDate.getMonth() - beforeMonth)
    if (beforeDay > 0 ) startDate.setDate(startDate.getDate() - beforeDay)
  } else {
    startDate = makeDate(start)
    endDate = makeDate(end)
  }

  return {
    results: await searchTrends(keywords, startDate, endDate)
  }
})

router.post('/daily', async function(req, res, next) {
  const body = req.body

  const keywords = body.keywords
  const start = body.startdate.split('.')
  const end = body.enddate.split('.')
  const interval = body.interval * 1000
  const repeatCount = body.repeatCount
  const beforeMonth = body.beforeMonth
  const beforeDay = body.beforeDay

  let startDate = ''
  let endDate = ''

  if (beforeMonth || beforeDay) {
    startDate = makeTodayDate()
    endDate = makeTodayDate()
    if (beforeMonth > 0 ) startDate.setMonth(startDate.getMonth() - beforeMonth)
    if (beforeDay > 0 ) startDate.setDate(startDate.getDate() - beforeDay)
  } else {
    startDate = makeDate(start)
    endDate = makeDate(end)
  }

  return {
    results: await getDaily(keywords, startDate, endDate, interval, repeatCount)
  }
})



router.post('/google-trend', async function(req, res, next) {
  const body = req.body

  const keywords = body.keywords
  const start = body.startdate.split('.')
  const end = body.enddate.split('.')
  const interval = body.interval * 1000
  const repeatCount = body.repeatCount
  const beforeYear = body.beforeYear
  const beforeMonth = body.beforeMonth
  const beforeDay = body.beforeDay


  let startDate = ''
  let endDate = ''

  if (beforeYear || beforeMonth || beforeDay) {
    startDate = makeTodayDate()
    endDate = makeTodayDate()

    if (beforeYear > 0 ) startDate.setFullYear(startDate.getFullYear() - beforeYear)
    if (beforeMonth > 0 ) startDate.setMonth(startDate.getMonth() - beforeMonth)
    if (beforeDay > 0 ) startDate.setDate(startDate.getDate() - beforeDay)
  } else {
    startDate = makeDate(start)
    endDate = makeDate(end)
  }

  // console.log('startdate1 : ', startdate)
  console.log('startdate2 : ', startDate.toString())
  // console.log('enddate1   : ', enddate)
  console.log('enddate2   : ', endDate.toString())
  const is_daily = (endDate-startDate)/(24*60*60*1000) < 270
  console.log('cal date : ', (endDate-startDate)/(24*60*60*1000))
  console.log("is_daily : ", is_daily)
  let results = []
  if (is_daily) {
    results = {
      "type": "daily",
      "result": await getDaily(keywords, startDate, endDate, interval, repeatCount)
    }

  } else {
    const weeklySearchResult = await searchTrends(keywords, startDate, endDate)
    let weeklyData = JSON.parse(weeklySearchResult).default.timelineData

    const WEEK = 37
    const DAILY_SEARCH_COUNT = Math.floor(weeklyData.length / WEEK)

    let afterResult = []
    const rawResult = []

    for(let i = 0; i < DAILY_SEARCH_COUNT; i++) {
      let week37data = weeklyData.splice(0, WEEK)
      let day37data = await convertWeeklyToDaily(week37data, keywords, interval, repeatCount,
                                        weeklyData.length % WEEK == 0 && i == DAILY_SEARCH_COUNT - 1 ? endDate : '',
                                        i == 0 ? startDate: '');
      afterResult = afterResult.concat(day37data)
      rawResult.push({ week37data: setProcessWeekly(week37data), day37data})
      console.log(" ===========================  ")
    }

    if (weeklyData.length % WEEK > 0) {
      let day37data = await convertWeeklyToDaily(weeklyData, keywords, interval, repeatCount, endDate);
      afterResult = afterResult.concat(day37data)
      rawResult.push({ week37data: setProcessWeekly(weeklyData), day37data})
    }

    results = {
      "type": "weekly",
      "result": afterResult,
      rawResult
    }
  }

  return res.send(results)
});

const searchTrends = (keyword, startTime, endTime) => {
  const searchParam = {
    keyword,
    startTime,
    endTime,
    geo: "JP",
    hl: "ja",
    granularTimeResolution: true
  }
  return googleTrends.interestOverTime(searchParam)
}

const makeDate = settings => {
  const date = moment().toDate()
  date.setFullYear(settings[0])
  date.setMonth(parseInt(settings[1]) - 1)
  date.setDate(parseInt(settings[2]))
  date.setHours(23,0,0)
  return date
}

const makeTodayDate = () => {
  const date = moment().toDate()
  date.setHours(23,0,0)
  return date
}

const sleep = interval => (new Promise(resolve => setTimeout(resolve, interval)))

const setProcess = data => {
  return JSON.parse(data).default.timelineData.map(item => {
    return {
        "formattedTime": item.formattedTime,
        "formattedValue": item.value[0]
    }
  })
}

const setProcessWeekly = data => {
  return data.map(item => {
    return {
      "formattedAxisTime": item.formattedAxisTime,
      "formattedTime": item.formattedTime,
      "formattedValue": item.value[0]
    }
  })
}

const getDaily = async (keywords, startDate, endDate, interval, repeatCount) => {
  const resultList = []

  for (let i = 0; i < repeatCount; i++) {
    const searchResult = await searchTrends(keywords, startDate, endDate)
    resultList.push(setProcess(searchResult))
    await sleep(interval)
  }
  // console.log('resultList[0] : ', resultList[0])
  const resultLength = resultList[0].length

  if (resultLength > 0) {
    for (let i = 0; i < resultLength; i++) {
      for (let j = 1; j < repeatCount; j++) {
        resultList[0][i].formattedValue += resultList[j][i].formattedValue
      }
      resultList[0][i].formattedValue /= repeatCount
    }
  }
  // console.log('searchResult 2 ::: ', resultList[0])
  return resultList[0]
}

async function convertWeeklyToDaily(week37data, keywords, interval, repeatCount, endDate, startDate) {
  let max = 0
  let date = ''

  week37data.forEach(item => {
    if (item.value[0] > max) {
      max = item.value[0]
      date = item.formattedAxisTime
    }
  })

  const startAxisTime = makeDate(week37data[0].formattedAxisTime.split('/'))
  const endAxisTime = makeDate(week37data[week37data.length - 1].formattedAxisTime.split('/'))
  endAxisTime.setDate(endAxisTime.getDate() + 6)
  let day37data = await getDaily(keywords, startDate || startAxisTime, endDate || endAxisTime, interval, repeatCount)
  let valueFound = 0

  day37data.some(item => {
    if (date == item.formattedTime) {
      valueFound = item.formattedValue
      return true
    }
    return false
  })
  console.log('max ', max)
  console.log('valueFound ', valueFound)

  return day37data.map(item => {
    item.formattedValue *= max / valueFound
    return item
  })
}

module.exports = router;
