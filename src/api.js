require('dotenv').config();
const fs = require('fs');
const {debug, toScreen} = require('./utils');
const root = require('app-root-path');
const connection = require('./connection');
const moment = require('moment');

const DEFAULT_DATA_DIR = `${root}/data/`;

if (!fs.existsSync(DEFAULT_DATA_DIR)) {
  fs.mkdirSync(DEFAULT_DATA_DIR);
}

const errMes = 'Ошибка при операции';

const readFile = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (e, data) => {
      if (e) {
        reject(e);
        return;
      }
      resolve(data);
    });
  })
}

const saveFile = async (path, data, silent = false) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, (e) => {
      if (e) {
        reject(e);
        return;
      }
      if (!silent) toScreen(`Данные сохранены в файл ${path}`);
      resolve();
    });
  })
}

const saveDataToFile = async ({data, filename, postfix, dir, silent}) => {
  try {
    let directory = dir ? dir : DEFAULT_DATA_DIR;
    const str = JSON.stringify(data, null, 2);
    let name = filename;
    if (postfix) {
      let parts = filename.split('.');
      if (parts.length !== 2) throw 'Ошибка в имени файла.';
      const ext = parts[parts.length - 1];
      name = `${parts[0]}_${postfix}.${ext}`;
    }
    if (str) await saveFile(`${directory}${name}`, str, silent);
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getStocks = async (connection) => {
  try {
    return await connection.stocks();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getCurrencies = async (connection) => {
  try {
    return await connection.currencies();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getAccounts = async (connection) => {
  try {
    return await connection.accounts();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getPortfolio = async (connection) => {
  try {
    return await connection.portfolio();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getPortfolioCurrencies = async (connection) => {
  try {
    return await connection.portfolioCurrencies();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getOrders = async (connection) => {
  try {
    return await connection.orders();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const saveOrders = async (orders) => {
  try {
    const str = JSON.stringify(orders, null, 2);
    if (str) await saveFile(`${root}/data/orders.json`, str);
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const getAndSaveAccounts = async () => {
  const data = await getAccounts(connection);
  await saveDataToFile({data, filename: 'accounts.json', silent: true});
  return data;
}

const getAndSavePortfolio = async (accID) => {
  const data = await getPortfolio(connection);
  await saveDataToFile({data, filename: 'portfolio.json', postfix: accID, silent: true});
  return data;
}

const getAndSavePortfolioCurrencies = async (accID) => {
  const data = await getPortfolioCurrencies(connection);
  await saveDataToFile({data, filename: 'currencies.json', postfix: accID, silent: true});
  return data;
}

const getAndSaveStocks = async () => {
  const data = await getStocks(connection);
  await saveDataToFile({data, filename: 'stocks.json', silent: true})
  return data;
}

const getAndSaveCurrencies = async () => {
  const data = await getCurrencies(connection);
  await saveDataToFile({data, filename: 'currencies.json', silent: true})
  return data;
}

const getInitialCurrencyPrices = async () => {
  return new Promise(resolve => {
    let EUR, USD;
    Promise.all([
      getCandlesLast7Days('BBG0013HJJ31').then(res => {EUR = res}),
      getCandlesLast7Days('BBG0013HGFT4').then(res => {USD = res})
    ])
      .then(() => {
        resolve({
          EUR: EUR[EUR.length - 1].c,
          USD: USD[USD.length - 1].c
        })
      })
      .catch(() => {
        resolve(null)
      })
  })
}

const getCurrentAccount = () => {
  try {
    return connection.getCurrentAccountId();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const setCurrentAccount = (accId) => {
  connection.setCurrentAccountId(accId);
  return getCurrentAccount();
}

const getCandlesLast7Days = async (figi) => {
  try {
    const {candles} = await connection.candlesGet({
      figi,
      interval: 'day',
      from: moment().subtract(7, 'd').format(),
      to: moment().format(),
    });
    return candles
  } catch {
    return null;
  }
}

module.exports = {
  readFile,
  saveFile,
  getStocks,
  getAccounts,
  getPortfolio,
  getOrders,
  saveOrders,
  getAndSaveStocks,
  getAndSaveAccounts,
  getAndSavePortfolio,
  getAndSavePortfolioCurrencies,
  getCurrentAccount,
  setCurrentAccount,
  getCandlesLast7Days,
  getAndSaveCurrencies,
  getInitialCurrencyPrices
}
