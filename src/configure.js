require('dotenv').config();
const inquirer = require('inquirer');
const {debug, toScreen} = require('./utils');
const store = require('./store');
const {getAllDeals, insertDeal, deleteDeal, deleteExecutedDeals} = require('./db');
const {noDealsMes} = require('./main');

const start = () => {
  toScreen('Выполнение...');
}

// const handleLoadAccounts = async () => {
//   start();
//   const accounts = await getAccounts(connection);
//   await saveAccounts(accounts);
// }
//
// const handleLoadPortfolio = async () => {
//   start();
//   const portfolio = await getPortfolio(connection);
//   await savePortfolio(portfolio);
// }
//
// const handleLoadOrders = async () => {
//   start();
//   const orders = await getOrders(connection);
//   await saveOrders(orders);
// }

const getDealMes = (i, deal) => {
  const {id, ticker, direction, trigger_price, order_type, order_price, lots, is_executed} = deal;
  const prefix = is_executed ? '[ИСПОЛНЕНА]' : '[АКТИВНА]  ';
  let ordStr = `ордер: ${direction}, ${order_type}, лотов ${lots}`;
  if (order_type === 'limit') {
    ordStr += `, цена исполнения: ${order_price}`;
  }
  return `${prefix} ${i + 1}. ${id.slice(0, 9)}... | ${ticker} | цена активации: ${trigger_price} | ${ordStr}`;
}

const showDeals = () => {
  return new Promise(async (resolve) => {
    const deals = await getAllDeals();
    if (deals) {
      deals.forEach((deal, i) => {
        const {is_executed} = deal;
        const mes = getDealMes(i, deal);
        const level = is_executed ? 'w' : 's';
        toScreen(mes, level);
      })
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
        name: getDealMes(i, deal),
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
          toScreen('Можно удалить еще одну сделку.', 'w');
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

const deleteExecuted = async () => {
  const result = await deleteExecutedDeals();
  if (result) {toScreen('Исполненные сделки удалены.', 's');}
  else {toScreen('Ошибка при удалении сделок.', 'e');}
}

const handleAddDeal = async () => {
  toScreen('Добавление сделки...', 'w');
  const params = {order_price: null};
  const askTicker = async () => {
    const q1 = [
      {
        type: 'input',
        name: 'ticker',
        message: 'Тикер'
      }
    ]
    let {ticker} = await inquirer.prompt(q1);
    ticker = ticker.toUpperCase();
    if (!store.tickersList.includes(ticker)) {
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
  params.ticker = await askTicker();
  params.direction = await askDirection();
  params.trigger_price = await askTriggerPrice();
  params.order_type = await askOrderType();
  if (params.order_type === 'limit') {
    params.order_price = await askOrderPrice();
  }
  params.lots = await askLots();
  const result = await insertDeal(params);
  if (result) {
    toScreen(`Сделка по тикеру ${params.ticker} добавлена.`, 's');
    return true;
  }
  toScreen('Ошибка при добавлении сделки.', 'e');
  return null;
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
    case 'delete_executed_deals':
      await deleteExecuted();
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
        name: 'Удалить исполненные сделки',
        value: 'delete_executed_deals'
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

module.exports = {ask};
