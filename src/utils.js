require('dotenv').config();
const chalk = require('chalk');
const {logify} = require('./logger');

// level: 'w' | 'e' | 's'
const toScreen = (message, level, prefix) => {
  const warning = chalk.bold.bgYellow.black;
  const error = chalk.bold.bgRed.white;
  const success = chalk.bold.bgGreen.white;
  let mes = ` ${message} `;
  if (prefix) mes = ` [${prefix}]${mes}`;
  if (level === 'w') mes = `${warning(mes)}`;
  if (level === 'e') mes = `${error(mes)}`;
  if (level === 's') mes = `${success(mes)}`;
  console.log(mes);
}

const toConsole = (time, data) => {
  console.log('▼▼▼▼▼▼▼▼▼▼▼');
  console.log(time.toISOString());
  console.log(data);
  console.log('▲▲▲▲▲▲▲▲▲▲▲');
}

const debug = (any) => {
  if (process.env.DEBUG === '1') {
    console.log('[DEBUG]');
    console.log(any);
  }
  if (any instanceof Error) {
    handleError(any)
  }
}

const pause = (timeout = 1500) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout)
  })
}

// level: c - critical
const handleError = (error, level) => {
  logify(error, 'error!', 'error');
  if (level === 'c') process.exit(1);
}

module.exports = {
  debug,
  toScreen,
  toConsole,
  pause
}
