const inquirer = require('inquirer');
const store = require('../store');
const {toScreen} = require('../utils');

const {availableCurrenciesList} = store;

const askTicker = async (stockOnly) => {
  let message;
  if (stockOnly) message = 'Тикер акции или расписки';
  else message = 'Тикер акции или расписки, "USDRUBTOM", "EURRUBTOM" для сделок с USD, EUR'
  const q1 = [
    {
      type: 'input',
      name: 'ticker',
      message
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
const askDirection = async (prefix) => {
  let questionText = 'Направление';
  if (prefix) questionText = `[${prefix}] ${questionText}`
  const q1 = [
    {
      type: 'list',
      name: 'direction',
      message: questionText,
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
const askTriggerPrice = async (prefix) => {
  let questionText = 'Цена актива, при достижении которой создастся ордер';
  if (prefix) questionText = `[${prefix}] ${questionText}`;
  const q1 = [
    {
      type: 'number',
      name: 'trigger_price',
      message: questionText,
    }
  ]
  let {trigger_price} = await inquirer.prompt(q1);
  if (Number(trigger_price) > 0) {
    return trigger_price;
  }
  toScreen(`Укажите положительное число.`, 'w');
  return await askTriggerPrice();
}
const askOrderType = async (prefix) => {
  let questionText = 'Тип ордера';
  if (prefix) questionText = `[${prefix}] ${questionText}`;
  const q1 = [
    {
      type: 'list',
      name: 'order_type',
      message: questionText,
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
const askOrderPrice = async (prefix) => {
  let questionText = 'Цена ордера';
  if (prefix) questionText = `[${prefix}] ${questionText}`;
  const q1 = [
    {
      type: 'number',
      name: 'order_price',
      message: questionText,
    }
  ]
  let {order_price} = await inquirer.prompt(q1);
  if (Number(order_price) > 0) {
    return order_price;
  }
  toScreen(`Укажите положительное число.`, 'w');
  return await askOrderPrice();
}
const askLots = async (prefix) => {
  let questionText = 'Количество лотов';
  if (prefix) questionText = `[${prefix}] ${questionText}`;
  const q1 = [
    {
      type: 'number',
      name: 'lots',
      message: questionText,
    }
  ]
  let {lots} = await inquirer.prompt(q1);
  if (Number(lots) > 0 && Number.isInteger(lots)) {
    return lots;
  }
  toScreen(`Укажите положительное целое число.`, 'w');
  return await askLots();
}

module.exports = {
  askTicker, askDirection, askTriggerPrice, askOrderType, askOrderPrice, askLots
}
