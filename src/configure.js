require('dotenv').config();
const inquirer = require('inquirer');
const connection = require('./connection');
const {getStocks, getAccounts, getPortfolio, getOrders, saveStocks, saveAccounts, savePortfolio, saveOrders} = require('./api');
const {debug, toScreen} = require('./utils');

const start = () => {
  console.log('Выполнение...');
}

const handleLoadStocks = async () => {
  start();
  const stocks = await getStocks(connection);
  await saveStocks(stocks);
}

const handleLoadAccounts = async () => {
  start();
  const accounts = await getAccounts(connection);
  await saveAccounts(accounts);
}

const handleLoadPortfolio = async () => {
  start();
  const portfolio = await getPortfolio(connection);
  await savePortfolio(portfolio);
}

const handleLoadOrders = async () => {
  start();
  const orders = await getOrders(connection);
  await saveOrders(orders);
}

const handleAction = async (answer) => {
  switch (answer) {
    case 'load_stocks':
      await handleLoadStocks();
      break;
    case 'load_accounts':
      await handleLoadAccounts();
      break;
    case 'load_portfolio':
      await handleLoadPortfolio();
      break;
    case 'load_orders':
      await handleLoadOrders();
      break;
    case 'close':
      console.log('Завершено!');
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
        name: 'Загрузить и сохранить список всех акций',
        value: 'load_stocks'
      },
      {
        name: 'Загрузить и сохранить список аккаунтов',
        value: 'load_accounts'
      },
      {
        name: 'Загрузить и сохранить данные по портфелю',
        value: 'load_portfolio'
      },
      {
        name: 'Загрузить и сохранить данные по ордерам',
        value: 'load_orders'
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
    await ask();
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

module.exports = ask;
