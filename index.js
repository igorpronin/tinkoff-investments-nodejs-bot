require('dotenv').config();
const {toTelegram} = require('./utils');
const connection = require('./connection');
const stocks = require('./data/stocks.json');

const list = ['AMZN', 'PHOR'];

const active = stocks.instruments.filter(item => {
  return list.includes(item.ticker);
})

const handleSubscriptionMessage = async (data) => {
  const {figi} = data;
  const asset = active.find(item => {
    return item.figi === figi;
  })
  data.ticker = asset.ticker;
  await toTelegram(JSON.stringify(data, null, 2));
}

active.forEach(item => {
  connection.instrumentInfo({figi: item.figi}, handleSubscriptionMessage);
})

// connection.instrumentInfo({figi: 'BBG000BVPV84'}, (data) => toTelegram(JSON.stringify(data, null, 2)));
// connection.orderbook({figi: 'BBG000BVPV84'}, (data) => console.log(data));

