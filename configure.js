require('dotenv').config();
const inquirer = require('inquirer');
const connection = require('./connection');
const {getStocks, getAccounts, getPortfolio, saveStocks, saveAccounts, savePortfolio} = require('./api');
const {debug, toScreen} = require('./utils');

const handleLoadStocks = async () => {
  console.log('Выполнение...');
  const stocks = await getStocks(connection);
  await saveStocks(stocks);
}

const handleLoadAccounts = async () => {
  console.log('Выполнение...');
  const accounts = await getAccounts(connection);
  await saveAccounts(accounts);
}

const handleLoadPortfolio = async () => {
  console.log('Выполнение...');
  const portfolio = await getPortfolio(connection);
  await savePortfolio(portfolio);
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

ask().then();
