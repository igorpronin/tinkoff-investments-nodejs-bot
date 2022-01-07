require('dotenv').config();
const {toTelegram} = require('./telegram');
const {toScreen} = require('./utils');
const connection = require('./connection');
// const winston = require('winston');
// const moment = require('moment');
const {getAllDeals, markDealAsExecuted} = require('./db');
const store = require('./store');
const {logify} = require('./logger');

const noDealsMes = 'Сделок нет. Добавьте сделки.';

const fillStocks = (deals) => {
  for (let deal of deals) {
    const {ticker} = deal;
    if (!store.activeStocksByTicker[ticker]) {
      const meta = store.stocksRaw.instruments.find(item => item.ticker === ticker);
      if (meta) {
        const {figi} = meta;
        store.activeStocksByTicker[ticker] = {
          deals: [],
          trade_status: null,
          best_bid: null,
          best_ask: null,
          meta,
          subscriptions: []
        }
        store.activeStocksByFigi[figi] = store.activeStocksByTicker[ticker];
      } else {
        toScreen(`Сохраненная сделка недоступна для торговли. Тикера ${ticker} нет в списке брокера.`, 'e');
        return;
      }
    }
    store.activeStocksByTicker[ticker].deals.push(deal);
  }
}

const prepare = async () => {
  const deals = await getAllDeals();
  if (!deals) {
    toScreen(noDealsMes, 'e');
    process.exit(1);
  }
  fillStocks(deals);
}

// Returns changed asset or null if something went wrong
const handleOrderBookStreamData = (data) => {
  const {figi} = data;
  const asset = store.activeStocksByFigi[figi];
  if (asset) {
    const best_bid = data?.bids?.[0]?.[0];
    const best_ask = data?.asks?.[0]?.[0];
    if (typeof best_bid !== 'undefined') {
      asset.best_bid = best_bid;
    }
    if (typeof best_ask !== 'undefined') {
      asset.best_ask = best_ask;
    }
    return asset;
  }
  return null;
}

const handleInstrumentInfoStreamData = (data) => {
  const {figi} = data;
  const asset = store.activeStocksByFigi[figi];
  if (asset) {
    const trade_status = data?.trade_status;
    if (typeof trade_status !== 'undefined') {
      asset.trade_status = trade_status;
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
    const result = {
      asset,
      triggered: triggeredDeals
    }
    logify(result, 'deal_triggered');
    return result;
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
        logify(res, 'send_order_response');
        handleSendOrderResponse(deal, res);
      });
    }
    if (order_type === 'market') {
      connection.marketOrder({
        figi,
        operation: direction,
        lots
      }).then(res => {
        logify(res, 'send_order_response');
        handleSendOrderResponse(deal, res);
      });
    }
  })
}

const runMain = async () => {
  logify({active_acc: store.activeAcc}, 'app_start');
  toScreen('Основной скрипт запущен!');
  await prepare();
  for (let key in store.activeStocksByTicker) {
    if (store.activeStocksByTicker.hasOwnProperty(key)) {
      const asset = store.activeStocksByTicker[key];
      const {meta} = asset;
      connection.instrumentInfo({figi: meta.figi}, (data) => {
        handleInstrumentInfoStreamData(data);
        logify(data, 'instrumentInfo');
      });
      asset.subscriptions.push('instrumentInfo');
      connection.orderbook({figi: meta.figi}, async (data) => {
        const asset = handleOrderBookStreamData(data);
        if (asset) {
          const triggeredObject = checkDeals(asset);
          if (triggeredObject) {
            await initOrders(triggeredObject);
          }
        }
        logify(data, 'orderbook');
      });
      asset.subscriptions.push('orderbook');
    }
  }
}

module.exports = {runMain, noDealsMes};
