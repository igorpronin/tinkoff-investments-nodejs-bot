const {toScreen} = require('./utils');
const store = require('./store');
const {
  getAndSaveStocks,
  getAndSaveCurrencies,
  getAndSaveAccounts,
  getAndSavePortfolio,
  getAndSavePortfolioCurrencies
} = require('./api');

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

module.exports = {
  getStocks,
  getCurrencies,
  getAccounts,
  getPortfolioByAccount,
  getPortfolioCurrenciesByAccount
}
