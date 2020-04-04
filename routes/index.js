const express = require('express');
const router = express.Router();
const googleTrends = require('google-trends-api')
const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo")

router.post('/daily-search', async function(req, res, next) {
  const body = req.body

  const keywords = body.keywords
  const start = body.startdate.split('.')
  const end = body.enddate.split('.')

  const result = await searchTrends(keywords, makeDate(start), makeDate(end))
  res.send(setProcess(result))
})

router.post('/weekly-search', async function(req, res, next) {
  const body = req.body

  const keywords = body.keywords
  const start = body.startdate.split('.')
  const end = body.enddate.split('.')

  const result = await searchTrends(keywords, makeDate(start), makeDate(end))
  res.send(setProcessWeekly(result))
})

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

const setProcess = data => {
  return JSON.parse(data).default.timelineData.map(item => {
    return {
        "formattedTime": item.formattedTime,
        "formattedValue": item.value[0]
    }
  })
}

const setProcessWeekly = data => {
  return JSON.parse(data).default.timelineData.map(item => {
    return {
      "formattedAxisTime": item.formattedAxisTime,
      "formattedTime": item.formattedTime,
      "formattedValue": item.value[0]
    }
  })
}

module.exports = router;
