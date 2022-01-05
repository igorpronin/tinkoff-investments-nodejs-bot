require('dotenv').config();
const fs = require('fs');
const {debug, toScreen} = require('./utils');
const root = require('app-root-path');
const connection = require('./connection');

const dir = 'data';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const errMes = 'Ошибка при операции';

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

const getStocks = async (connection) => {
  try {
    return await connection.stocks();
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

const getOrders = async (connection) => {
  try {
    return await connection.orders();
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const saveStocks = async (stocks, silent = false) => {
  try {
    const str = JSON.stringify(stocks, null, 2);
    if (str) await saveFile(`${root}/data/stocks.json`, str, silent);
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const saveAccounts = async (accounts) => {
  try {
    const str = JSON.stringify(accounts, null, 2);
    if (str) await saveFile(`${root}/data/accounts.json`, str);
  } catch (e) {
    toScreen(errMes, 'e');
    debug(e);
  }
}

const savePortfolio = async (portfolio) => {
  try {
    const str = JSON.stringify(portfolio, null, 2);
    if (str) await saveFile(`${root}/data/portfolio.json`, str);
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

const getAndSaveStocks = async () => {
  const stocks = await getStocks(connection);
  await saveStocks(stocks, true);
  return stocks;
}

module.exports = {
  saveFile,
  getStocks,
  getAccounts,
  getPortfolio,
  getOrders,
  saveStocks,
  saveAccounts,
  savePortfolio,
  saveOrders,
  getAndSaveStocks
}
