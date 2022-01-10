require('dotenv').config();
const {toTelegram} = require('./telegram');
const {debug, toScreen} = require('./utils');
const connection = require('./connection');
const {getAllDeals, markDealAsExecuted} = require('./db');
const store = require('./store');
const {logify} = require('./logger');

const noDealsMes = 'Сделок нет. Добавьте сделки.';

const fillStocksAndCurrenciesDeals = (deals) => {
  for (let deal of deals) {
    const {ticker, type} = deal;
    if (type === 'stock') {
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
    if (type === 'currency' && ticker === 'USDRUBTOM') {
      store.currencies.USD.deals.push(deal);
    }
    if (type === 'currency' && ticker === 'EURRUBTOM') {
      store.currencies.EUR.deals.push(deal);
    }
  }
}

const prepare = async () => {
  const deals = await getAllDeals();
  if (!deals) {
    toScreen(noDealsMes, 'e');
    process.exit(1);
  }
  fillStocksAndCurrenciesDeals(deals);
}

const instrumentInfoStreamHandler = async (data) => {
  handleInstrumentInfoStreamData(data);
  logify(data, 'instrumentInfo');
}

const orderBookStreamHandler = async (data) => {
  const asset = handleOrderBookStreamData(data);
  if (asset) {
    const triggeredObject = checkStockDeals(asset);
    if (triggeredObject) {
      await initOrders(triggeredObject);
    }
  }
  logify(data, 'orderbook_stock');
}

const orderBookStreamCurrencyHandler = async (data) => {
  const {figi, bids, asks} = data;
  let best_bid, best_ask;
  if (bids && bids.length) {
    best_bid = bids[0]?.[0];
  }
  if (asks && asks.length) {
    best_ask = asks[0]?.[0];
  }
  if (figi === 'BBG0013HGFT4') { // UDS
    if (best_bid && best_ask) {
      store.currencies.USD.price = (best_bid + best_ask) / 2;
    }
    if (best_bid) {
      store.currencies.USD.best_bid = best_bid;
    }
    if (best_ask) {
      store.currencies.USD.best_ask = best_ask;
    }
    const triggered = checkCurrencyDeals('USD');
    if (triggered) {
      await initOrders(triggered);
    }
  }
  if (figi === 'BBG0013HJJ31') { // EUR
    if (best_bid && best_ask) {
      store.currencies.EUR.price = (best_bid + best_ask) / 2;
    }
    if (best_bid) {
      store.currencies.EUR.best_bid = best_bid;
    }
    if (best_ask) {
      store.currencies.EUR.best_ask = best_ask;
    }
    const triggered = checkCurrencyDeals('EUR');
    if (triggered) {
      await initOrders(triggered);
    }
  }
  logify(data, 'orderbook_currency');
}

const instrumentInfoStreamCurrencyHandler = (data) => {
  const {figi, trade_status} = data;
  if (figi === 'BBG0013HGFT4') { // UDS
    store.currencies.USD.trade_status = trade_status;
  }
  if (figi === 'BBG0013HJJ31') { // EUR
    store.currencies.EUR.trade_status = trade_status;
  }
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

const checkStockDeals = (asset) => {
  const {trade_status, deals, best_bid, best_ask} = asset;
  if (trade_status !== 'normal_trading') return null;
  const triggeredDeals = [];
  if (!deals) return null;
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
      type: 'stk', // stock
      asset,
      triggered: triggeredDeals
    }
    logify(result, 'deals_stock_triggered');
    return result;
  }
  return null;
}

// currency: USD | EUR
const checkCurrencyDeals = (currency) => {
  const {trade_status, deals, best_bid, best_ask} = store.currencies[currency];
  if (trade_status !== 'normal_trading') return null;
  const triggeredDeals = [];
  if (!deals) return null;
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
      type: 'cur', // currency
      asset: currency,
      triggered: triggeredDeals
    }
    logify(result, 'deals_currency_triggered');
    return result;
  }
  return null;
}

// returns true если лимит исчерпан
const checkLimits = (deal, asset) => {
  const {best_bid, best_ask, meta} = asset;
  const {lot, currency} = meta;
  const {id, direction, lots} = deal;
  let dealSumRUB;
  if (direction === 'Sell') {
    dealSumRUB = best_bid * lot * lots;
  }
  if (direction === 'Buy') {
    dealSumRUB = best_ask * lot * lots;
  }
  if (currency !== 'RUB') {
    dealSumRUB = dealSumRUB * store.currencies[currency].price;
  }
  if (direction === 'Sell') {
    if (store.ordersActivateLimit.Sell && store.sumOrdersSellActivatedRUB + dealSumRUB > store.ordersActivateLimit.Sell) {
      toTelegram('Установленный лимит продаж не позволяет отправить ордер. Ордер не отправлен.').then();
      return true;
    }
    store.sumOrdersSellActivatedRUB = store.sumOrdersSellActivatedRUB + dealSumRUB;
  }
  if (direction === 'Buy') {
    if (store.ordersActivateLimit.Buy && store.sumOrdersBuyActivatedRUB + dealSumRUB > store.ordersActivateLimit.Buy) {
      toTelegram(`Установленный лимит покупок не позволяет отправить ордер по сделке ${id}. Ордер не отправлен.`).then();
      return true;
    }
    store.sumOrdersBuyActivatedRUB = store.sumOrdersBuyActivatedRUB + dealSumRUB;
  }
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

const handleSendOrderError = (deal, error) => {
  const {id} = deal;
  const {payload, status} = error;
  const {message} = payload;
  let mes = `Результат отправки ордера по сделке\n${id}.\n`;
  mes += `Статус: ${status}\n`;
  if (message) {
    mes += `Дополнительно: ${message}`;
  }
  toTelegram(mes).then();
}

const initOrders = async (triggeredObject) => {
  const {asset, triggered, type} = triggeredObject;
  let figi;
  if (type === 'stk') {
    figi = asset.meta.figi;
  }
  if (type === 'cur') {
    figi = store.currencies[asset].figi;
  }
  triggered.forEach(deal => {
    const {direction, order_type, order_price, lots, is_limited} = deal;
    try {
      if (is_limited) {
        const isLimit = checkLimits(deal, asset);
        if (isLimit) return;
      }
    } catch (e) {
      debug(e);
      toTelegram('Ошибка при проверке лимитов торговли. Ордер не отправлен.').then();
      return;
    }
    if (order_type === 'limit') {
      connection.limitOrder({
        figi,
        operation: direction,
        lots,
        price: order_price
      }).then(res => {
        logify(res, 'send_order_response');
        handleSendOrderResponse(deal, res);
      })
        .catch(e => {
          handleSendOrderError(deal, e);
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
      })
        .catch(e => {
          handleSendOrderError(deal, e);
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
      connection.instrumentInfo({figi: meta.figi}, instrumentInfoStreamHandler);
      asset.subscriptions.push('instrumentInfo');
      connection.orderbook({figi: meta.figi}, orderBookStreamHandler);
      asset.subscriptions.push('orderbook');
    }
  }
  for (let key in store.currencies) {
    if (store.currencies.hasOwnProperty(key)) {
      const currency = store.currencies[key];
      const {figi} = currency;
      connection.instrumentInfo({figi}, instrumentInfoStreamCurrencyHandler);
      connection.orderbook({figi}, orderBookStreamCurrencyHandler);
    }
  }
}

module.exports = {runMain, noDealsMes};
