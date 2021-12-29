require('dotenv').config();
// const {toTelegram} = require('./telegram');
const {toScreen} = require('./utils');
const connection = require('./connection');
const stocks = require('./data/stocks.json');
const winston = require('winston');
const moment = require('moment');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.1.log'}),
  ],
});

const listOfInstrumentInfoSubscriptions = ['AMZN', 'PHOR'];

const activeInstrumentInfoSubscriptions = stocks.instruments.filter(item => {
  return listOfInstrumentInfoSubscriptions.includes(item.ticker);
})

const listOfOrderBookSubscriptions = ['PHOR'];

const activeOrderBookSubscriptions = stocks.instruments.filter(item => {
  return listOfOrderBookSubscriptions.includes(item.ticker);
})

const handleSubscriptionInstrumentInfoMessage = async (data) => {
  const {figi} = data;
  const asset = activeInstrumentInfoSubscriptions.find(item => item.figi === figi)
  if (asset) data.ticker = asset.ticker;
  const time = moment();
  data.time = time.toISOString();
  // data.time = time.format();
  const text = JSON.stringify(data, null, 2);
  console.log('▼▼▼▼▼▼▼▼▼▼▼');
  console.log(time);
  toScreen(text);
  console.log('▲▲▲▲▲▲▲▲▲▲▲');
  logger.log({
    level: 'info',
    message: text
  });
  // await toTelegram(text);
}

const handleSubscriptionOrderBookMessage = async (data) => {
  const {figi} = data;
  const asset = activeOrderBookSubscriptions.find(item => item.figi === figi)
  if (asset) data.ticker = asset.ticker;
  const time = moment();
  data.time = time.toISOString();
  // data.time = time.format();
  console.log('▼▼▼▼▼▼▼▼▼▼▼');
  console.log(time);
  console.log(data);
  console.log('▲▲▲▲▲▲▲▲▲▲▲');
  logger.log({
    level: 'info',
    message: JSON.stringify(data)
  });
}

const runMain = () => {
  toScreen('Основной скрипт запущен!')
  activeInstrumentInfoSubscriptions.forEach(item => {
    connection.instrumentInfo({figi: item.figi}, handleSubscriptionInstrumentInfoMessage);
  })
  activeOrderBookSubscriptions.forEach(item => {
    connection.orderbook({figi: item.figi}, handleSubscriptionOrderBookMessage);
  })
}

module.exports = runMain;
