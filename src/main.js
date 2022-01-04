require('dotenv').config();
const {toTelegram} = require('./telegram');
const {toScreen} = require('./utils');
const connection = require('./connection');
const root = require('app-root-path');
const winston = require('winston');
const moment = require('moment');
const {getAllDeals, markDealAsExecuted} = require('./db');
const {getAndSaveStocks} = require('./api');

let deals, instrumentsList, activeSubscriptions;
const store = {}

const fillStore = (deals) => {
  deals.forEach(deal => {
    const {ticker} = deal;
    if (!store[ticker]) {
      store[ticker] = {
        deals: [],
        best_bid: null,
        best_ask: null
      }
    }
    store[ticker].deals.push(deal);
  })
}

const fillActiveSubscriptions = (stocks) => {
  activeSubscriptions = stocks.instruments.filter(item => {
    return instrumentsList.includes(item.ticker);
  })
  activeSubscriptions.forEach(item => {
    store[item.ticker].meta = item;
  })
}

const prepare = async () => {
  const deals = await getAllDeals();
  if (!deals) {
    toScreen('Сделок нет. Добавьте сделки.', 'e');
    process.exit(1);
  }
  const stocks = require(`${root}/data/stocks.json`);
  fillStore(deals);
  instrumentsList = Object.keys(store);
  fillActiveSubscriptions(stocks);
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.log'}),
  ],
});

const logify = (data) => {
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

const handleDealExec = async (deal) => {
  const {id, ticker, direction, trigger_price, order_type, order_price, lots} = deal;
  let mes = `Исполнение сделки...\n`;
  mes += `ID: ${id}\n`;
  if (direction === 'Sell') {
    mes += `${ticker} больше ${trigger_price}.\n`;
  }
  if (direction === 'Buy') {
    mes += `${ticker} меньше ${trigger_price}.\n`;
  }
  mes += `Отправка ${direction}-ордера типа "${order_type}"\n`;
  if (order_type === 'limit') {
    mes += `по цене ${order_price}\n`;
  }
  mes += `количество лотов: ${lots}\n`;
  deal.is_executed = true;
  markDealAsExecuted(id).then();
  toTelegram(mes).then();
}

const checkDeals = (asset) => {
  const {trade_status, deals, best_bid, best_ask} = asset;
  if (trade_status !== 'normal_trading') return;
  const triggeredDeals = [];
  if (!deals) return;
  deals.forEach(async deal => {
    const {id, direction, trigger_price, order_type, order_price, lots, is_executed} = deal;
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
        triggeredDeals.push(deal);
        handleDealExec(deal).then();
      }
    }
    if (direction === 'Buy') {
      if (!best_ask) return;
      if (best_ask <= trigger_price) {
        triggeredDeals.push(deal);
        handleDealExec(deal).then();
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

const handleSendOrderResponse = (deal, responseObj) => {
  const {id} = deal;
  const {status, message} = responseObj;
  let mes = `Результат отправки ордера по сделке\n${id}.\n`;
  mes += `Статус: ${status}\n`;
  if (message) {
    mes += `Дополнительно: ${message}`;
  }
  toTelegram(mes).then();
}

const initOrders = async (triggeredObject) => {
  // console.log(triggeredObject)
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
        logify(res);
        handleSendOrderResponse(deal, res);
      });
    }
    if (order_type === 'market') {
      connection.marketOrder({
        figi,
        operation: direction,
        lots
      }).then(res => {
        logify(res);
        handleSendOrderResponse(deal, res);
      });
    }
  })
}

const runMain = () => {
  toScreen('Основной скрипт запущен!');
  getAndSaveStocks().then(async () => {
    await prepare();
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
            await initOrders(triggeredObject);
          }
        }
        logify(data);
      });
    });
  })
}

module.exports = {runMain, store};
