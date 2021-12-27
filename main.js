require('dotenv').config();
const {toTelegram} = require('./telegram');
const {toScreen} = require('./utils');
const connection = require('./connection');
const stocks = require('./data/stocks.json');

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
  const text = JSON.stringify(data, null, 2);
  console.log('▼▼▼▼▼▼▼▼▼▼▼');
  console.log(new Date());
  toScreen(text);
  console.log('▲▲▲▲▲▲▲▲▲▲▲');
  await toTelegram(text);
}

const handleSubscriptionOrderBookMessage = async (data) => {
  const {figi} = data;
  const asset = activeOrderBookSubscriptions.find(item => item.figi === figi)
  if (asset) data.ticker = asset.ticker;
  console.log('▼▼▼▼▼▼▼▼▼▼▼');
  console.log(new Date());
  console.log(data);
  console.log('▲▲▲▲▲▲▲▲▲▲▲');
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
