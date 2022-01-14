require('dotenv').config();
const inquirer = require('inquirer');
const {debug, toScreen} = require('./utils');
const store = require('./store');
const {getAllDeals, insertDeal, deleteDeal, deleteExecutedDeals, setSettingVal, updateDealIsExecuted} = require('./db');
const {noDealsMes} = require('./main');
const {setCurrentAccount, getCandlesLast7Days} = require('./api');

const {availableCurrenciesList} = store;

// const handleLoadAccounts = async () => {
//   start();
//   const accounts = await getAccounts(connection);
//   await saveAccounts(accounts);
// }
//
// const handleLoadOrders = async () => {
//   start();
//   const orders = await getOrders(connection);
//   await saveOrders(orders);
// }

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

const showTotalsActive = async () => {
  const deals = await getAllDeals();
  const total = {
    stocks: {
      activeBuys: 0,
      activeSells: 0
    },
    currencies: {
      activeBuys: 0,
      activeSells: 0
    }
  }
  deals.forEach((deal, i) => {
    const {is_executed, direction, type} = deal;
    const {sum} = getDealMesAndSum(i, deal);
    if (!is_executed) {
      if (direction === 'Buy' && type === 'stock') {
        total.stocks.activeBuys = total.stocks.activeBuys + sum;
      }
      if (direction === 'Sell' && type === 'stock') {
        total.stocks.activeSells = total.stocks.activeSells + sum;
      }
      if (direction === 'Buy' && type === 'currency') {
        total.currencies.activeBuys = total.currencies.activeBuys + sum;
      }
      if (direction === 'Sell' && type === 'currency') {
        total.currencies.activeSells = total.currencies.activeSells + sum;
      }
    }
  })
  if (total.stocks.activeBuys) toScreen(`Сумма по активным сделкам на покупку акций: ${total.stocks.activeBuys.toFixed(2)} RUB`, 'w');
  if (total.stocks.activeSells) toScreen(`Сумма по активным сделкам на продажу акций: ${total.stocks.activeSells.toFixed(2)} RUB`, 'w');
  if (total.currencies.activeBuys) toScreen(`Сумма по активным сделкам на покупку валют: ${total.currencies.activeBuys.toFixed(2)} RUB`, 'w');
  if (total.currencies.activeSells) toScreen(`Сумма по активным сделкам на продажу валют: ${total.currencies.activeSells.toFixed(2)} RUB`, 'w');
}

const showDeals = () => {
  return new Promise(async (resolve) => {
    const deals = await getAllDeals();
    if (deals) {
      deals.forEach((deal, i) => {
        const {is_executed} = deal;
        const {mes} = getDealMesAndSum(i, deal);
        const level = is_executed ? 'w' : 's';
        toScreen(mes, level);
      })
      showTotalsActive(deals);
    } else {
      toScreen(noDealsMes, 'w');
      resolve();
      return;
    }
    setTimeout(() => {
      resolve();
    }, 1500)
  })
}

const deleteOne = async () => {
  const deals = await getAllDeals();
  if (deals) {
    const menu = {
      type: 'list',
      name: 'answer',
      choices: []
    };
    deals.forEach((deal, i)=> {
      const {id} = deal;
      const row = {
        name: getDealMesAndSum(i, deal).mes,
        value: id
      }
      menu.choices.push(row);
    })
    menu.choices.push({
      name: 'Назад',
      value: 'end'
    });
    const {answer} = await inquirer.prompt([menu]);
    if (answer !== 'end') {
      const result = await deleteDeal(answer);
      if (result) {
        toScreen('Сделка удалена.', 's');
        if (deals.length === 1) {
          toScreen('Сохраненных сделок больше нет.', 'w');
        } else {
          toScreen('Можно удалить другие сделки.', 'w');
          await deleteOne();
        }
      } else {
        toScreen('Ошибка при удалении сделки.', 'e');
      }
    }
  } else {
    toScreen(noDealsMes, 'w');
  }
}

const resetOne = async () => {
  const deals = await getAllDeals(true);
  if (deals) {
    const menu = {
      type: 'list',
      name: 'answer',
      choices: []
    };
    deals.forEach((deal, i)=> {
      const {id} = deal;
      const row = {
        name: getDealMesAndSum(i, deal).mes,
        value: id
      }
      menu.choices.push(row);
    })
    menu.choices.push({
      name: 'Назад',
      value: 'end'
    });
    const {answer} = await inquirer.prompt([menu]);
    if (answer !== 'end') {
      const result = await updateDealIsExecuted(answer, 0);
      if (result) {
        toScreen('Сделка снова активна.', 's');
        if (deals.length === 1) {
          toScreen('Исполненных сделок больше нет, все сделки активны.', 'w');
        } else {
          toScreen('Можно сбросить другие сделки.', 'w');
          await resetOne();
        }
      } else {
        toScreen('Ошибка при сбросе сделки.', 'e');
      }
    }
  } else {
    toScreen(noDealsMes, 'w');
  }
}

const deleteExecuted = async () => {
  const result = await deleteExecutedDeals();
  if (result) {toScreen('Исполненные сделки удалены.', 's');}
  else {toScreen('Ошибка при удалении сделок.', 'e');}
}

const askTicker = async () => {
  const q1 = [
    {
      type: 'input',
      name: 'ticker',
      message: 'Тикер акции или расписки, "USDRUBTOM", "EURRUBTOM" для сделок с USD, EUR'
    }
  ]
  let {ticker} = await inquirer.prompt(q1);
  ticker = ticker.toUpperCase();
  if (!(store.tickersList.includes(ticker) || availableCurrenciesList.includes(ticker))) {
    toScreen(`Тикера ${ticker} нет в списке доступных для торговли. Укажите другой.`, 'w');
    ticker = await askTicker();
  }
  return ticker;
}
const askDirection = async () => {
  const q1 = [
    {
      type: 'list',
      name: 'direction',
      message: 'Направление',
      choices: [
        {
          value: 'Buy',
          name: 'Купить'
        },
        {
          value: 'Sell',
          name: 'Продать'
        }
      ]
    }
  ]
  let {direction} = await inquirer.prompt(q1);
  return direction;
}
const askTriggerPrice = async () => {
  const q1 = [
    {
      type: 'number',
      name: 'trigger_price',
      message: 'Цена актива, при достижении которой создастся ордер',
    }
  ]
  let {trigger_price} = await inquirer.prompt(q1);
  if (Number(trigger_price) > 0) {
    return trigger_price;
  }
  toScreen(`Укажите положительное число.`, 'w');
  return await askTriggerPrice();
}
const askOrderType = async () => {
  const q1 = [
    {
      type: 'list',
      name: 'order_type',
      message: 'Тип ордера',
      choices: [
        {
          value: 'limit',
          name: 'Лимитный'
        },
        {
          value: 'market',
          name: 'Рыночный'
        }
      ]
    }
  ]
  let {order_type} = await inquirer.prompt(q1);
  return order_type;
}
const askOrderPrice = async () => {
  const q1 = [
    {
      type: 'number',
      name: 'order_price',
      message: 'Цена ордера',
    }
  ]
  let {order_price} = await inquirer.prompt(q1);
  if (Number(order_price) > 0) {
    return order_price;
  }
  toScreen(`Укажите положительное число.`, 'w');
  return await askOrderPrice();
}
const askLots = async () => {
  const q1 = [
    {
      type: 'number',
      name: 'lots',
      message: 'Количество лотов',
    }
  ]
  let {lots} = await inquirer.prompt(q1);
  if (Number(lots) > 0 && Number.isInteger(lots)) {
    return lots;
  }
  toScreen(`Укажите положительное целое число.`, 'w');
  return await askLots();
}

const addStockDeal = async (params) => {
  params.type = 'stock';
  params.is_limited = 1;
  const asset = store.stocksRaw.instruments.find(item => item.ticker === params.ticker);
  params.lot = asset.lot;
  params.currency = asset.currency;
  const candles = await getCandlesLast7Days(asset.figi);
  params.price = candles[candles.length - 1].c;
  let m1 = `Выбрано: ${params.ticker}, ${asset.name} | В лоте шт.: ${asset.lot} | Валюта: ${asset.currency}`;
  if (params.price) {
    m1 += ` | Цена: ${params.price.toFixed(2)} ${asset.currency}`;
    if (asset.currency === 'USD' || asset.currency === 'EUR') {
      m1 += ` (${(params.price * store.currencies[asset.currency].price).toFixed(2)} RUB)`
    }
    if (asset.lot > 1) {
      const lotPrice = params.price * asset.lot;
      m1 += ` (за лот ${lotPrice.toFixed(2)}`;
      if (asset.currency === 'USD' || asset.currency === 'EUR') {
        m1 += `, ${(lotPrice * store.currencies[asset.currency].price).toFixed(2)} RUB`
      }
      m1 += ')';
    }
  }
  toScreen(m1, 'w');
  params.direction = await askDirection();
  params.lots = await askLots();
  if (params.price) {
    const price = params.price * asset.lot * params.lots;
    let m2 = `Сумма сделки по текущей цене: ${price.toFixed(2)} ${asset.currency}`;
    if (asset.currency === 'USD' || asset.currency === 'EUR') {
      m2 += ` (${(price * store.currencies[asset.currency].price).toFixed(2)} RUB)`
    }
    toScreen(m2, 'w');
  }
  params.trigger_price = await askTriggerPrice();
  const goalPrice = params.trigger_price * asset.lot * params.lots;
  let m3 = `Сумма сделки по целевой цене: ${goalPrice.toFixed(2)} ${asset.currency}`;
  if (asset.currency === 'USD' || asset.currency === 'EUR') {
    m3 += ` (${(goalPrice * store.currencies[asset.currency].price).toFixed(2)} RUB)`
  }
  toScreen(m3, 'w');
  params.order_type = await askOrderType();
  if (params.order_type === 'limit') {
    params.order_price = await askOrderPrice();
  }
  return await insertDeal(params);
}

const addCurrencyDeal = async (params) => {
  params.type = 'currency';
  params.is_limited = 0;
  params.lot = 1000;
  params.currency = 'RUB';
  if (params.ticker === 'USDRUBTOM') {
    params.price = store.currencies.USD.price;
  }
  if (params.ticker === 'EURRUBTOM') {
    params.price = store.currencies.EUR.price;
  }
  let m1 = `Выбрано: ${params.ticker} | В лоте шт.: 1000`;
  if (params.price) {
    m1 += ` | Цена: ${params.price.toFixed(2)} RUB (за лот ${(params.price * 1000).toFixed(2)})`;
  }
  toScreen(m1, 'w');
  params.direction = await askDirection();
  params.lots = await askLots();
  if (params.price) {
    const price = params.price * 1000 * params.lots;
    let m2 = `Сумма сделки по текущей цене: ${price.toFixed(2)} RUB`;
    toScreen(m2, 'w');
  }
  params.trigger_price = await askTriggerPrice();
  const goalPrice = params.trigger_price * 1000 * params.lots;
  let m3 = `Сумма сделки по целевой цене: ${goalPrice.toFixed(2)} RUB`;
  toScreen(m3, 'w');
  params.order_type = await askOrderType();
  if (params.order_type === 'limit') {
    params.order_price = await askOrderPrice();
  }
  toScreen('Внимание! Сделки по валютам не ограничены установленным лимитом покупок/продаж.', 'w');
  return await insertDeal(params);
}

const handleAddDeal = async () => {
  toScreen('Добавление сделки...', 'w');
  const params = {order_price: null};
  params.ticker = await askTicker();
  let result;
  if (availableCurrenciesList.includes(params.ticker)) {
    result = await addCurrencyDeal(params);
  } else {
    result = await addStockDeal(params);
  }
  if (result) {
    toScreen(`Сделка по тикеру ${params.ticker} добавлена.`, 's');
    return true;
  }
  toScreen('Ошибка при добавлении сделки.', 'e');
  return null;
}

const setAcc = async () => {
  toScreen('Установка счета для торговли...', 'w');
  const choices = [];
  const q1 = [
    {
      type: 'list',
      name: 'accID',
      message: 'Аккаунт',
      choices
    }
  ]
  store.accounts.forEach(acc => {
    choices.push({
      value: acc.brokerAccountId,
      name: `${acc.brokerAccountType}, ${acc.brokerAccountId}`
    })
  })
  let {accID} = await inquirer.prompt(q1);
  setCurrentAccount(accID);
  store.activeAcc = accID;
  await setSettingVal('active_acc', accID);
  toScreen(`Активный счет ${accID} установлен.`, 's');
}

const setLimits = async () => {
  toScreen('Установка лимитов на покупку/продажу, в рублях, за одну сессию...', 'w');
  const q1 = [
    {
      type: 'list',
      name: 'direction',
      message: 'Направление ордеров.',
      choices: [
        {
          value: 'max_buy_sum',
          name: 'Лимиты покупок'
        },
        {
          value: 'max_sell_sum',
          name: 'Лимиты продаж'
        }
      ]
    }
  ]
  const {direction} = await inquirer.prompt(q1);
  const askSum = async () => {
    const q2 = [
      {
        type: 'number',
        name: 'sum',
        message: 'Введите сумму',
      }
    ]
    let {sum} = await inquirer.prompt(q2);
    if (Number(sum) > 0 && Number.isInteger(sum)) {
      return sum;
    }
    toScreen(`Укажите положительное целое число.`, 'w');
    return await askSum();
  }
  const sum = await askSum();
  await setSettingVal(direction, sum);
  let mes;
  if (direction === 'max_buy_sum') {
    store.ordersActivateLimit.Buy = sum;
    mes = `Лимит покупок установлен. Текущий лимит покупок: ${sum} RUB.`;
  }
  if (direction === 'max_sell_sum') {
    store.ordersActivateLimit.Sell = sum;
    mes = `Лимит продаж установлен. Текущий лимит продаж: ${sum} RUB.`;
  }
  toScreen(mes, 's');
}

const handleAction = async (answer) => {
  switch (answer) {
    case 'deals':
      await showDeals();
      await ask();
      break;
    case 'add_deal':
      await handleAddDeal();
      await ask();
      break;
    case 'delete_deal':
      await deleteOne();
      await ask();
      break;
    case 'reset_deal':
      await resetOne();
      await ask();
      break;
    case 'delete_executed_deals':
      await deleteExecuted();
      await ask();
      break;
    case 'set_acc':
      await setAcc();
      await ask();
      break;
    case 'set_limits':
      await setLimits();
      await ask();
      break;
    case 'close':
      toScreen('Завершено!');
      process.exit();
      break;
  }
}

const ask = async () => {
  const actions = {
    type: 'list',
    name: 'action',
    message: 'Что сделать?',
    choices: [
      {
        name: 'Показать сделки',
        value: 'deals'
      },
      {
        name: 'Добавить сделку',
        value: 'add_deal'
      },
      {
        name: 'Удалить сделку',
        value: 'delete_deal'
      },
      {
        name: 'Активировать сделку',
        value: 'reset_deal'
      },
      {
        name: 'Удалить исполненные сделки',
        value: 'delete_executed_deals'
      },
      {
        name: 'Выбрать счет для торговли',
        value: 'set_acc'
      },
      {
        name: 'Установить ограничения сумм сделок',
        value: 'set_limits'
      },
      {
        name: 'Завершить',
        value: 'close'
      }
    ],
  }
  const questions = [actions];
  try {
    const answers = await inquirer.prompt(questions);
    await handleAction(answers.action);
  } catch (e) {
    toScreen('Ошибка', 'e');
    debug(e);
    if (e.isTtyError) {
      // Prompt couldn't be rendered in the current environment
    } else {
      // Something else went wrong
    }
  }
}

module.exports = {ask, showTotalsActive};
