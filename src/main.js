require('dotenv').config();
const {toTelegram, sendMessagesToAdminOneByOne} = require('./telegram');
const {debug, toScreen} = require('./utils');
const connection = require('./connection');
const {getAllDeals, updateDealIsExecuted, getAllPairDeals, updatePairDealStatus} = require('./db');
const store = require('./store');
const {logify} = require('./logger');
const cron = require('node-cron');
const lo = require('lodash');
const {getAndSavePortfolio} = require('./api');
const {getPortfolioByAccount} = require('./get_data_funcs');

// отправка по понедельникам информации о сделках
const mondayTask = cron.schedule('0 11 * * 1', () =>  {
  sendDealsToTelegram().then();
}, {
  scheduled: false
});

const hourlyTask = cron.schedule('0 * * * *', () =>  {
  sendDealsToTelegram().then();
}, {
  scheduled: false
});

const dailyDask = cron.schedule('0 11 * * *', () =>  {
  sendDealsToTelegram().then();
}, {
  scheduled: false
});

const getDealMesAndSum = (i, deal) => {
  const {id, ticker, direction, trigger_price, order_type, order_price, lots, lot, is_executed, currency} = deal;
  const prefix = is_executed ? '[ИСПОЛНЕНА]' : '[АКТИВНА]  ';
  let ordStr = `ордер: ${direction}, ${order_type}, лотов ${lots}`;
  if (order_type === 'limit') {
    ordStr += `, цена исполнения: ${order_price}`;
  }
  let dealSum = trigger_price * lots * lot;
  if (currency !== 'RUB') {
    const currencyPrice = store.currencies[currency].price;
    dealSum = dealSum * currencyPrice;
  }
  const mes = `${prefix} ${i + 1}. ${id.slice(0, 9)}... | ${ticker} | цена активации: ${trigger_price} | ${ordStr} | сумма сделки: ${dealSum.toFixed(2)} RUB`;
  return {mes, sum: dealSum}
}

const getFormattedDealsMessagesForTelegram = (deals) => {
  const TG_MESSAGE_SYMBOLS_LIMIT = 2000;
  let messages = [];
  let message = '';
  deals.forEach((deal, i) => {
    let {mes: oneMoreMessage} = getDealMesAndSum(i, deal);
    oneMoreMessage += '\n---\n';
    if ((message.length + oneMoreMessage.length) > TG_MESSAGE_SYMBOLS_LIMIT) {
      messages.push(message);
      message = '';
      message += oneMoreMessage;
    } else {
      message += oneMoreMessage;
    }
  })
  messages.push(message);
  return messages;
}

const sendDealsToTelegram = async () => {
  const deals = await getAllDeals();
  const messages = getFormattedDealsMessagesForTelegram(deals);
  await sendMessagesToAdminOneByOne(messages);
}

const noDealsMes = 'Сделок нет. Добавьте сделки.';

const noNonActiveDealsMes = 'Исполненных сделок нет. Активировать нечего.'

const fillStocksAndCurrenciesDeals = (deals, pairDeals) => {
  const template = {
    deals: [],
    pair_deals: [],
    trade_status: null,
    best_bid: null,
    best_ask: null,
    subscriptions: []
  }
  for (let deal of deals) {
    const {ticker, type} = deal;
    if (type === 'stock') {
      if (!store.activeStocksByTicker[ticker]) {
        const meta = store.stocksRaw.instruments.find(item => item.ticker === ticker);
        if (meta) {
          const {figi} = meta;
          store.activeStocksByTicker[ticker] = {...lo.cloneDeep(template), meta};
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
  for (let pairDeal of pairDeals) {
    const {ticker} = pairDeal;
    if (!store.activeStocksByTicker[ticker]) {
      const meta = store.stocksRaw.instruments.find(item => item.ticker === ticker);
      if (meta) {
        const {figi} = meta;
        store.activeStocksByTicker[ticker] = {...lo.cloneDeep(template), meta};
        store.activeStocksByFigi[figi] = store.activeStocksByTicker[ticker];
      } else {
        toScreen(`Сохраненная сделка недоступна для торговли. Тикера ${ticker} нет в списке брокера.`, 'e');
        return;
      }
    }
    store.activeStocksByTicker[ticker].pair_deals.push(pairDeal);
  }
}

const prepare = async () => {
  const deals = await getAllDeals();
  const pairDeals = await getAllPairDeals();
  if (!(deals || pairDeals)) {
    toScreen(noDealsMes, 'e');
    process.exit(1);
  }
  fillStocksAndCurrenciesDeals(deals, pairDeals);
}

const instrumentInfoStreamHandler = async (data) => {
  handleInstrumentInfoStreamData(data);
  logify(data, 'instrumentInfo');
}

const orderBookStreamHandler = async (data) => {
  const asset = handleOrderBookStreamData(data);
  if (asset) {
    // Проверка сигналов
    const triggeredObject = checkStockDeals(asset);
    const triggeredPairDealsObject = checkStockPairDeals(asset);

    // Исполнение ордеров при срабатывании триггеров (лучше, наверное, запаралелить, но может и нет)
    if (triggeredObject) {
      await initOrders(triggeredObject);
    }
    if (triggeredPairDealsObject && !store.hasPendingPairDeals) {
      await getPortfolioByAccount(store.activeAcc);
      await handleInitOrdersForPaidDeals(triggeredPairDealsObject);
      await trailPendingPairDeals();
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
  updateDealIsExecuted(id, 1).then();
  toTelegram(mes).then();
}

const handlePairDealExec = (deal) => {
  const {
    id, ticker,
    open_direction, open_trigger_price, open_order_type, open_order_price, open_lots, open_status,
    close_direction, close_trigger_price, close_order_type, close_order_price, close_lots, close_status
  } = deal;
  let mes = '';
  if (open_status === 'active') {
    mes = `Исполнение парной открывающей сделки...\n`;
    mes += `ID: ${id}\n`;
    if (open_direction === 'Sell') {
      mes += `${ticker} больше ${open_trigger_price}.\n`;
    }
    if (open_direction === 'Buy') {
      mes += `${ticker} меньше ${open_trigger_price}.\n`;
    }
    mes += `Отправка ${open_direction}-ордера типа "${open_order_type}"\n`;
    if (open_order_type === 'limit') {
      mes += `по цене ${open_order_price}\n`;
    }
    mes += `количество лотов: ${open_lots}\n`;
  }
  if (open_status === 'executed' && close_status === 'active') {
    mes = `Исполнение парной закрывающей сделки...\n`;
    mes += `ID: ${id}\n`;
    if (close_direction === 'Sell') {
      mes += `${ticker} больше ${close_trigger_price}.\n`;
    }
    if (close_direction === 'Buy') {
      mes += `${ticker} меньше ${close_trigger_price}.\n`;
    }
    mes += `Отправка ${close_direction}-ордера типа "${close_order_type}"\n`;
    if (close_order_type === 'limit') {
      mes += `по цене ${close_order_price}\n`;
    }
    mes += `количество лотов: ${close_lots}\n`;
  }
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

    // todo переместить валидацию параметров сделок на момент запуска скрипта
    // Начало валидации параметров сделок
    if (!lots) return;
    if (!trigger_price) return;
    if (!direction) return;
    if (!(direction === 'Buy' || direction === 'Sell')) return;
    if (!(order_type === 'limit' || order_type === 'market')) return;
    if (order_type === 'limit' && !order_price) return;
    // Конец валидации параметров сделок

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
      type: 'stk', // stock, используется далее как флаг доступа к активу в сторе
      asset,
      triggered: triggeredDeals
    }
    logify(result, 'deals_stock_triggered');
    return result;
  }
  return null;
}

const checkStockPairDeals = async (asset) => {
  const {trade_status, pairDeals, best_bid, best_ask} = asset;
  if (trade_status !== 'normal_trading') return null;
  const triggeredPairDeals = [];
  if (!pairDeals) return null;
  pairDeals.forEach(pairDeal => {
    const {
      open_direction, open_trigger_price, open_status,
      close_direction, close_trigger_price, close_status,
    } = pairDeal;

    // 1. Проверяем открывающую сделку, должна быть активной для работы с ней
    // 2. Если открывающая сделка исполнена, проверяем закрывающую сделку
    // 3. Если закрывающая сделка не активна, или закрыта, ничего не делаем

    if (open_status === 'active') {
      if (open_direction === 'Sell') {
        if (!best_bid) return;
        if (best_bid >= open_trigger_price) {
          triggeredPairDeals.push(pairDeal);
          handlePairDealExec(pairDeal);
        }
      }
      if (open_direction === 'Buy') {
        if (!best_ask) return;
        if (best_ask <= open_trigger_price) {
          triggeredPairDeals.push(pairDeal);
          handlePairDealExec(pairDeal);
        }
      }
    }
    if (open_status === 'executed' && close_status === 'active') {
      if (close_direction === 'Sell') {
        if (!best_bid) return;
        if (best_bid >= close_trigger_price) {
          triggeredPairDeals.push(pairDeal);
          handlePairDealExec(pairDeal);
        }
      }
      if (close_direction === 'Buy') {
        if (!best_ask) return;
        if (best_ask <= close_trigger_price) {
          triggeredPairDeals.push(pairDeal);
          handlePairDealExec(pairDeal);
        }
      }
    }
  })
  if (triggeredPairDeals.length) {
    const result = {
      type: 'pair_stk', // pair deals, stock
      asset,
      triggered: triggeredPairDeals
    }
    logify(result, 'pair_deals_stock_triggered');
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

const handleSendOrderResponse = (deal, responseObj, isPair) => {
  const {id} = deal;
  const {status, message} = responseObj;
  let mes;
  if (!isPair) mes = `Результат отправки ордера по сделке\n${id}.\n`;
  if (isPair) mes = `Результат отправки ордера по ПАРНОЙ сделке\n${id}.\n`;
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

const handleInitOrdersForPaidDeals = async (triggeredObject) => {
  const {asset, triggered, type} = triggeredObject;
  const defineOrderParams = (deal) => {
    const {
      id,
      open_direction, open_status, open_order_type, open_order_price, open_lots,
      close_direction, close_status, close_order_type, close_order_price, close_lots
    } = deal;
    const params = {figi}
    let side, orderType;
    if (open_status === 'active') {
      side = 'open';
      orderType = open_order_type;
      params.operation = open_direction;
      params.lots = open_lots;
      if (open_order_type === 'limit') {
        params.price = open_order_price;
      }
    }
    if (open_status === 'executed' && close_status === 'active') {
      side = 'close';
      orderType = close_order_type;
      params.operation = close_direction;
      params.lots = close_lots;
      if (close_order_type === 'limit') {
        params.price = close_order_price;
      }
    }
    return {id, side, orderType, params};
  }
  let figi;
  if (type === 'pair_stk') {
    figi = asset.meta.figi;
  }
  const {positions} = await getAndSavePortfolio(store.activeAcc);
  store.portfolio[store.activeAcc] = positions;
  store.hasPendingPairDeals = true;
  for (let i = 0; i < triggered; i++) {
    const pairDeal = triggered[i];
    const orderParams = defineOrderParams(pairDeal);
    if (orderParams.side === 'open') {
      pairDeal.open_status = 'pending';
    }
    if (orderParams.side === 'close') {
      pairDeal.close_status = 'pending';
    }
    await updatePairDealStatus(pairDeal.id, orderParams.side, 'pending');
    store.pendingOrdersByPairDeals.add(orderParams);
    if (orderParams.orderType === 'limit') {
      try {
        const resLimit = await connection.limitOrder(orderParams.params);
        logify(resLimit, 'send_order_response');
        handleSendOrderResponse(pairDeal, resLimit, true);
      } catch (e) {
        handleSendOrderError(pairDeal, e);
      }
    }
    if (orderParams.orderType === 'market') {
      try {
        const resMarket = await connection.marketOrder(orderParams.params);
        logify(resMarket, 'send_order_response');
        handleSendOrderResponse(pairDeal, resMarket, true);
      } catch (e) {
        handleSendOrderError(pairDeal, e);
      }
    }
  }
}

const trailPendingPairDeals = () => {
  const initialPortfolio = lo.cloneDeep(store.portfolio[store.activeAcc]);
  return new Promise((resolve, reject) => {
    const pendingOrders = store.pendingOrdersByPairDeals;
    const cycle = async () => {
      if (!pendingOrders.size) {
        store.hasPendingPairDeals = false;
        resolve();
        return;
      }
      await getPortfolioByAccount(store.activeAcc);
      const expectedDeals = {};
      const assets = new Set();
      pendingOrders.forEach(item => {
        const {figi, operation, lots} = item.params;
        assets.add(figi);
        if (typeof expectedDeals[figi] !== 'undefined') expectedDeals[figi] = {
          lots: 0,
          orders: new Set()
        };
        expectedDeals[figi].orders.add(item);
        if (operation === 'Buy') expectedDeals[figi].lots += lots;
        if (operation === 'Sell') expectedDeals[figi].lots -= lots;
      })
      for (let figi in expectedDeals) {
        const item = expectedDeals[figi];
        const initialPortfolioAsset = initialPortfolio.find(item => item.figi === figi);
        const initialLots = initialPortfolioAsset ? initialPortfolioAsset.lots : 0;
        const expectedLots = initialLots + item.lots;
        const orders = item.orders;
        if (initialLots === expectedLots) {
          orders.forEach(async (order) => {
            const {id, side, orderType, params} = order;
            if (side === 'open') {

            }
            if (side === 'close') {

            }
            pendingOrders.delete(order);
          });
        }
      }
      setTimeout(() => {
        cycle();
      }, 1000)
    }
    cycle();
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
  sendDealsToTelegram().then();
  // mondayTask.start();
  // hourlyTask.start();
  dailyDask.start();
}

module.exports = {runMain, noDealsMes, noNonActiveDealsMes, getDealMesAndSum};
