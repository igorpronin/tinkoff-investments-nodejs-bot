require('dotenv').config();

const {toScreen, debug} = require('./src/utils');
const {version, name} = require('./package.json');
toScreen(`${name}, version: ${version}`, 's');
const inquirer = require('inquirer');
const {ask: configure} = require('./src/configure');
const {runMain} = require('./src/main');
const {getAndSaveStocks, getAndSaveAccounts, getCurrentAccount} = require('./src/api');
const store = require('./src/store');

const args = {};

process.argv.forEach(item => {
  try {
    if (item.startsWith('-')) {
      const parts = item.split('=');
      const arg = parts[0].substring(1);
      args[arg] = parts[1];
    }
  } catch {}
})

const handleAction = async (answer) => {
  switch (answer) {
    case 'run_config':
      await configure();
      break;
    case 'run_main':
      await runMain();
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
        name: 'Настроить',
        value: 'run_config'
      },
      {
        name: 'Запустить скрипт',
        value: 'run_main'
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
      toScreen('Скрипт не может быть запущен в этой среде (на этом компьютере).', 'e');
    }
  }
}

const getStocks = async () => {
  toScreen('Обновляется список доступных акций...');
  store.stocksRaw = await getAndSaveStocks();
  const {instruments} = store.stocksRaw;
  store.tickersList = instruments.map(item => item.ticker);
  toScreen('Список доступных акций обновлен.');
}

const getAccounts = async () => {
  toScreen('Запрашивается список счетов...');
  store.accounts = await getAndSaveAccounts();
  toScreen('Список счетов получен.');
}

const run = async () => {
  await Promise.all([
    getStocks(),
    getAccounts()
  ])
  if ((process.env.FORCE_START === '1' && args.F !== '0') || args.F === '1') {
    await runMain();
  } else {
    await ask();
  }
}

run();

