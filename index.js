require('dotenv').config();

const {toScreen, debug} = require('./src/utils');
const {version, name} = require('./package.json');
const moment = require('moment');
const getSize = require('get-folder-size');
const root = require('app-root-path');

const getLogsSize = () => {
  return new Promise((resolve, reject) => {
    getSize(`${root}/logs`, (err, size) => {
      if (err) reject(err);
      resolve((size / 1024 / 1024).toFixed(2) + ' MB');
    });
  })
}

const startTime = moment().format('YYYY-MM-DD h:mm:ss a');
toScreen(`${name}, version: ${version}, start time: ${startTime}`, 's');

const inquirer = require('inquirer');
const {ask: configure} = require('./src/configure');
const {runMain} = require('./src/main');
const {
  getAndSaveStocks, getAndSaveAccounts, getAndSavePortfolio, getInitialCurrencyPrices,
  setCurrentAccount, getAndSavePortfolioCurrencies, getAndSaveCurrencies
} = require('./src/api');
const {getSettingByKey, setSettingVal, getOrdersLimitSum} = require('./src/db');
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

const getCurrencies = async () => {
  toScreen('Обновляется список доступных валютных инструментов...');
  store.currenciesRaw = await getAndSaveCurrencies();
  toScreen('Список доступных валютных инструментов обновлен.');
}

const getAccounts = async () => {
  toScreen('Запрашивается список счетов...');
  const {accounts} = await getAndSaveAccounts();
  store.accounts = accounts;
  toScreen('Список счетов получен.');
}

const getPortfolioByAccount = async (accID) => {
  toScreen(`Запрашивается портфель по счету ${accID}...`);
  const {positions} = await getAndSavePortfolio(accID);
  store.portfolio[accID] = positions;
  toScreen(`Портфель получен по счету ${accID}.`);
}

const getPortfolioCurrenciesByAccount = async (accID) => {
  toScreen(`Запрашиваются валюты по счету ${accID}...`);
  const {currencies} = await getAndSavePortfolioCurrencies(accID);
  store.portfolioCurrencies[accID] = currencies;
  toScreen(`Валюты получены по счету ${accID}.`);
}

const fillInitialCurrencyPrices = async () => {
  toScreen(`Запрашиваются цены валют...`);
  try {
    const {USD, EUR} = await getInitialCurrencyPrices();
    store.currencies.USD.price = USD;
    store.currencies.EUR.price = EUR;
    toScreen(`Цены валют получены.`);
  } catch (e) {
    debug(e);
    toScreen('Ошибка при запросе цен валют.', 'e');
  }
}

const fillLimits = async () => {
  await Promise.all([
    getOrdersLimitSum('Buy').then(({value}) => {
      if (value) {
        store.ordersActivateLimit.Buy = Number(value);
      }
    }),
    await getOrdersLimitSum('Sell').then(({value}) => {
      if (value) {
        store.ordersActivateLimit.Sell = Number(value);
      }
    })
  ])
}

const showActiveAcc = () => {
  toScreen(`Активный счет: ${store.activeAcc}`, 'w');
  let mes1 = `Остатки |`;
  let mes2 = `Заблокировано |`;
  let emptyMes1 = true;
  let emptyMes2 = true;
  store.portfolioCurrencies[store.activeAcc].forEach(cur => {
    const {currency, balance, blocked} = cur;
    if (balance !== 0) {
      mes1 += ` ${balance.toFixed(2)} ${currency} |`;
      emptyMes1 = false;
    }
    if (blocked && blocked !== 0) {
      mes2 += ` ${blocked.toFixed(2)} ${currency} |`;
      emptyMes2 = false;
    }
  })
  if (!emptyMes1) toScreen(mes1, 'w');
  if (!emptyMes2) toScreen(mes2, 'w');
}

const showLimits = () => {
  if (store.ordersActivateLimit.Sell || store.ordersActivateLimit.Buy) {
    const limits = [];
    if (store.ordersActivateLimit.Buy) {
      limits.push(`на покупку ${store.ordersActivateLimit.Buy} RUB`)
    }
    if (store.ordersActivateLimit.Sell) {
      limits.push(`на продажу ${store.ordersActivateLimit.Sell} RUB`)
    }
    const str = limits.join(', ');
    let mes = `Текущие лимиты сделок: ${str}`;
    toScreen(mes, 'w');
  }
}

const run = async () => {
  const folderSize = await getLogsSize();
  debug(`Размер директории с log-файлами: ${folderSize}`);
  await Promise.all([
    getStocks(),
    getAccounts(),
    getCurrencies(),
    fillInitialCurrencyPrices(),
    fillLimits()
  ]);
  for (let i = 0; i < store.accounts.length; i++) {
    const accID = store.accounts[i].brokerAccountId;
    setCurrentAccount(accID);
    await Promise.all([
      getPortfolioByAccount(accID),
      getPortfolioCurrenciesByAccount(accID)
    ])
  }
  const {value} = await getSettingByKey('active_acc');
  const accountsList = store.accounts.map(acc => acc.brokerAccountId);
  if (accountsList.includes(value)) {
    store.activeAcc = value;
  } else {
    store.activeAcc = accountsList[0];
    await setSettingVal('active_acc', accountsList[0]);
  }
  setCurrentAccount(store.activeAcc);
  showActiveAcc();
  showLimits();
  if ((process.env.FORCE_START === '1' && args.F !== '0') || args.F === '1') {
    await runMain();
  } else {
    await ask();
  }
}

run();

