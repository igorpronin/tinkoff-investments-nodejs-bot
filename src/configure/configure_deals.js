require('dotenv').config();
const inquirer = require('inquirer');
const {debug, toScreen} = require('../utils');
const store = require('../store');
const {getAllDeals, insertDeal, deleteDeal, deleteExecutedDeals, setSettingVal, updateDealIsExecuted} = require('../db');
const {noDealsMes, noNonActiveDealsMes, getDealMesAndSum} = require('../main');
const {getCandlesLast7Days} = require('../api');
const {askTicker, askDirection, askTriggerPrice, askOrderType, askOrderPrice, askLots} = require('./deal_params_prompts');

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

const showTotalsActive = async () => {
  const deals = await getAllDeals();
  if (!deals) {
    toScreen(`Активных единичных сделок на покупку акций нет`, 'w');
    return;
  }
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
    toScreen(noNonActiveDealsMes, 'w');
  }
}

const deleteExecuted = async () => {
  const result = await deleteExecutedDeals();
  if (result) {toScreen('Исполненные сделки удалены.', 's');}
  else {toScreen('Ошибка при удалении сделок.', 'e');}
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
      await askConfigDeals();
      break;
    case 'add_deal':
      await handleAddDeal();
      await askConfigDeals();
      break;
    case 'delete_deal':
      await deleteOne();
      await askConfigDeals();
      break;
    case 'reset_deal':
      await resetOne();
      await askConfigDeals();
      break;
    case 'delete_executed_deals':
      await deleteExecuted();
      await askConfigDeals();
      break;
    case 'set_limits':
      await setLimits();
      await askConfigDeals();
      break;
    case 'close':
      toScreen('Завершено!');
      process.exit();
      break;
  }
}

const askConfigDeals = async () => {
  const actions = {
    type: 'list',
    name: 'action',
    message: 'Что сделать?',
    choices: [
      {
        name: 'Показать единичные сделки',
        value: 'deals'
      },
      {
        name: 'Добавить единичную сделку',
        value: 'add_deal'
      },
      {
        name: 'Удалить единичную сделку',
        value: 'delete_deal'
      },
      {
        name: 'Активировать единичную сделку',
        value: 'reset_deal'
      },
      {
        name: 'Удалить исполненные единичные сделки',
        value: 'delete_executed_deals'
      },
      {
        name: 'Установить ограничения сумм единичных сделок',
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

module.exports = {
  askConfigDeals,
  showTotalsActive
};
