require('dotenv').config();
// const {toTelegram} = require('./telegram');
const {toScreen} = require('./utils');
const connection = require('./connection');
const stocks = require('./../data/stocks.json');
const winston = require('winston');
const moment = require('moment');
const deals = require('./../deals.json');

const store = {};

const instrumentsList = Object.keys(deals);

instrumentsList.forEach(item => {
  store[item] = {
    deals: deals[item],
    best_bid: null,
    best_ask: null
  }
})

const activeSubscriptions = stocks.instruments.filter(item => {
  return instrumentsList.includes(item.ticker);
})

activeSubscriptions.forEach(item => {
  store[item.ticker].meta = item;
})

const toConsole = (time, data) => {
  console.log('▼▼▼▼▼▼▼▼▼▼▼');
  console.log(time.toISOString());
  console.log(data);
  console.log('▲▲▲▲▲▲▲▲▲▲▲');
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.1.log'}),
  ],
});

const logify = async (data) => {
  const {figi} = data;
  const asset = activeSubscriptions.find(item => item.figi === figi)
  if (asset) data.ticker = asset.ticker;
  const time = moment();
  data.time = time.toISOString();
  // toConsole(time, data);
  logger.log({
    level: 'info',
    message: JSON.stringify(data)
  });
}

// Returns changed asset or null if something went wrong
const handleOrderBookStreamData = (data) => {
  const {figi} = data;
  const asset = activeSubscriptions.find(item => item.figi === figi)
  if (asset) {
    const best_bid = data?.bids?.[0]?.[0];
    const best_ask = data?.asks?.[0]?.[0];
    if (typeof best_bid !== 'undefined') {
      store[asset.ticker].best_bid = best_bid;
    }
    if (typeof best_ask !== 'undefined') {
      store[asset.ticker].best_ask = best_ask;
    }
    return store[asset.ticker];
  }
  return null;
}

const handleInstrumentInfoStreamData = (data) => {
  const {figi} = data;
  const asset = activeSubscriptions.find(item => item.figi === figi)
  if (asset) {
    const trade_status = data?.trade_status;
    if (typeof trade_status !== 'undefined') {
      store[asset.ticker].trade_status = trade_status;
    }
  }
}

const checkDeals = (asset) => {
  const {trade_status, deals, best_bid, best_ask} = asset;
  if (trade_status !== 'normal_trading') return;
  const triggeredDeals = [];
  deals.forEach(deal => {
    const {direction, trigger_price, order_type, order_price, lots, is_executed} = deal;
    if (is_executed) return;
    if (!lots) return;
    if (!trigger_price) return;
    if (!direction) return;
    if (!(direction === 'Buy' || direction === 'Sell')) return;
    if (!(order_type === 'limit' || order_type === 'market')) return;
    if (order_type === 'limit' && !order_price) return;
    if (direction === 'Sell') {
      if (!best_bid) return;
      if (best_bid >= trigger_price) {
        deal.is_executed = true;
        triggeredDeals.push(deal);
      }
    }
    if (direction === 'Buy') {
      if (!best_ask) return;
      if (best_ask <= trigger_price) {
        deal.is_executed = true;
        triggeredDeals.push(deal);
      }
    }
  })
  if (triggeredDeals.length) {
    return {
      asset,
      triggered: triggeredDeals
    }
  }
  return null;
}

const initOrders = async (triggeredObject) => {
  const {asset, triggered} = triggeredObject;
  const {figi} = asset.meta;
  triggered.forEach(deal => {
    const {direction, order_type, order_price, lots} = deal;
    if (order_type === 'limit') {
      connection.limitOrder({
        figi,
        operation: direction,
        lots,
        price: order_price
      }).then(res => {
        console.log(res);
      });
    }
    if (direction === 'market') {
      connection.marketOrder({
        figi,
        operation: direction,
        lots
      }).then(res => {
        console.log(res);
      });
    }
    // if (direction === 'buy') {
    //   console.log('SENDIND BUY ORDER');
    // }
    // if (direction === 'sell') {
    //   console.log('SENDIND SELL ORDER');
    // }
  })
}

const runMain = () => {
  toScreen('Основной скрипт запущен!')
  activeSubscriptions.forEach(item => {
    connection.instrumentInfo({figi: item.figi}, (data) => {
      handleInstrumentInfoStreamData(data);
      logify(data);
    });
    connection.orderbook({figi: item.figi}, async (data) => {
      const asset = handleOrderBookStreamData(data);
      if (asset) {
        const triggeredObject = checkDeals(asset);
        if (triggeredObject) {
          initOrders(triggeredObject).then();
        }
      }
      logify(data);
      // console.log(store);
    });
  })
}

module.exports = {runMain, store};
