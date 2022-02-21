require('dotenv').config();
const inquirer = require('inquirer');
const {debug, toScreen} = require('../utils');
const store = require('../store');
const {insertPairDeal} = require('../db');
const {getCandlesLast7Days} = require('../api');
const {askTicker, askDirection, askTriggerPrice, askOrderType, askOrderPrice, askLots} = require('./deal_params_prompts');

const askDealType = async () => {
  const q1 = [
    {
      type: 'list',
      name: 'value',
      message: 'Тип сделки',
      choices: [
        {
          value: 'once',
          name: 'Разовая парная сделка'
        },
        {
          value: 'repeat',
          name: 'Повторяющаяся парная сделка'
        }
      ]
    }
  ]
  let {value} = await inquirer.prompt(q1);
  return value;
}

const handleAddPairDeal = async () => {
  const openDealMesPrefix = 'ОТКРЫВАЮЩАЯ СДЕЛКА';
  const closeDealMesPrefix = 'ЗАКРЫВАЮЩАЯ СДЕЛКА';
  toScreen('Добавление сделки...', 'w');
  const params = {};
  params.ticker = await askTicker(true);
  const asset = store.stocksRaw.instruments.find(item => item.ticker === params.ticker);
  params.lot = asset.lot;
  params.currency = asset.currency;
  params.cycles = 0;
  const candles = await getCandlesLast7Days(asset.figi);
  const currentPrice = candles[candles.length - 1].c;
  let m1 = `Выбрано: ${params.ticker}, ${asset.name} | В лоте шт.: ${asset.lot} | Валюта: ${asset.currency}`;
  if (currentPrice) {
    m1 += ` | Цена: ${currentPrice.toFixed(2)} ${asset.currency}`;
    if (asset.currency === 'USD' || asset.currency === 'EUR') {
      m1 += ` (${(currentPrice * store.currencies[asset.currency].price).toFixed(2)} RUB)`
    }
    if (asset.lot > 1) {
      const lotPrice = currentPrice * asset.lot;
      m1 += ` (за лот ${lotPrice.toFixed(2)}`;
      if (asset.currency === 'USD' || asset.currency === 'EUR') {
        m1 += `, ${(lotPrice * store.currencies[asset.currency].price).toFixed(2)} RUB`
      }
      m1 += ')';
    }
  }
  toScreen(m1, 'w');
  params.type = await askDealType();

  // Запрос данных по открывающей сделке
  params.open_direction = await askDirection(openDealMesPrefix);
  params.open_lots = await askLots(openDealMesPrefix);
  if (currentPrice) {
    const price = currentPrice * asset.lot * params.open_lots;
    let m2 = `Сумма сделки по текущей цене: ${price.toFixed(2)} ${asset.currency}`;
    if (asset.currency === 'USD' || asset.currency === 'EUR') {
      m2 += ` (${(price * store.currencies[asset.currency].price).toFixed(2)} RUB)`
    }
    toScreen(m2, 'w');
  }
  params.open_trigger_price = await askTriggerPrice(openDealMesPrefix);
  const goalOpenPrice = params.open_trigger_price * asset.lot * params.open_lots;
  let m3 = `Сумма сделки по целевой цене: ${goalOpenPrice.toFixed(2)} ${asset.currency}`;
  if (asset.currency === 'USD' || asset.currency === 'EUR') {
    m3 += ` (${(goalOpenPrice * store.currencies[asset.currency].price).toFixed(2)} RUB)`
  }
  toScreen(m3, 'w');
  params.open_order_type = await askOrderType(openDealMesPrefix);
  if (params.open_order_type === 'limit') {
    params.open_order_price = await askOrderPrice(openDealMesPrefix);
  }
  params.open_status = 'not_active';

  // Запрос данных по закрывающей сделке
  if (params.open_direction === 'Buy') params.close_direction = 'Sell';
  if (params.open_direction === 'Sell') params.close_direction = 'Buy';
  params.close_lots = await askLots(closeDealMesPrefix);
  if (currentPrice) {
    const price = currentPrice * asset.lot * params.close_lots;
    let m4 = `Сумма сделки по текущей цене: ${price.toFixed(2)} ${asset.currency}`;
    if (asset.currency === 'USD' || asset.currency === 'EUR') {
      m4 += ` (${(price * store.currencies[asset.currency].price).toFixed(2)} RUB)`
    }
    toScreen(m4, 'w');
  }
  params.close_trigger_price = await askTriggerPrice(closeDealMesPrefix);
  const goalClosePrice = params.close_trigger_price * asset.lot * params.close_lots;
  let m5 = `Сумма сделки по целевой цене: ${goalClosePrice.toFixed(2)} ${asset.currency}`;
  if (asset.currency === 'USD' || asset.currency === 'EUR') {
    m5 += ` (${(goalClosePrice * store.currencies[asset.currency].price).toFixed(2)} RUB)`
  }
  toScreen(m5, 'w');
  params.close_order_type = await askOrderType(closeDealMesPrefix);
  if (params.close_order_type === 'limit') {
    params.close_order_price = await askOrderPrice(closeDealMesPrefix);
  }
  params.close_status = 'not_active';

  let incomePrc, incomeSum;
  if (params.open_direction === 'Buy') {
    incomeSum = params.close_trigger_price - params.open_trigger_price;
    incomePrc = (incomeSum / params.open_trigger_price) * 100;
  }
  if (params.open_direction === 'Sell') {
    incomeSum = params.open_trigger_price - params.close_trigger_price;
    incomePrc = (incomeSum / params.open_trigger_price) * 100;
  }
  let m6 = `Примерная доходность сделки при полном лоте: ${incomePrc.toFixed(2)}%, ${incomeSum * params.open_lots * params.lot} ${asset.currency}`;
  toScreen(m6, 'w');

  const result = await insertPairDeal(params);
  if (result) {
    toScreen(`Сделка по тикеру ${params.ticker} добавлена.`, 's');
    return true;
  }
  toScreen('Ошибка при добавлении сделки.', 'e');
  return null;
}

const handleAction = async (answer) => {
  switch (answer) {
    case 'pair_deals':
      //
      await askConfigPairDeals();
      break;
    case 'add_pair_deal':
      await handleAddPairDeal();
      await askConfigPairDeals();
      break;
    case 'delete_pair_deal':
      //
      await askConfigPairDeals();
      break;
    case 'reset_pair_deal':
      //
      await askConfigPairDeals();
      break;
    case 'set_pair_deals_limits':
      //
      await askConfigPairDeals();
      break;
    case 'close':
      toScreen('Завершено!');
      process.exit();
      break;
  }
}

const askConfigPairDeals = async () => {
  const actions = {
    type: 'list',
    name: 'action',
    message: 'Что сделать?',
    choices: [
      {
        name: 'Показать парные сделки',
        value: 'pair_deals'
      },
      {
        name: 'Добавить парную сделку',
        value: 'add_pair_deal'
      },
      {
        name: 'Удалить парную сделку',
        value: 'delete_pair_deal'
      },
      {
        name: 'Активировать парную сделку',
        value: 'reset_pair_deal'
      },
      {
        name: 'Установить ограничения сумм парных сделок',
        value: 'set_pair_deals_limits'
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
  askConfigPairDeals
}
