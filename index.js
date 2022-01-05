require('dotenv').config();

const {toScreen, debug} = require('./src/utils');
const {version, name} = require('./package.json');
toScreen(`${name}, version: ${version}`, 's');
const inquirer = require('inquirer');
const {ask: configure} = require('./src/configure');
const {runMain} = require('./src/main');
const {getAndSaveStocks} = require('./src/api');
const store = require('./src/store');

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

const run = async () => {
  await getStocks();
  if (process.env.FORCE_START === '1') {
    await runMain();
  } else {
    await ask();
  }
}

run();

