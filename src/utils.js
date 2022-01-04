require('dotenv').config();
const chalk = require('chalk');

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

const debug = (mes) => {
  if (process.env.DEBUG === '1') console.log(` [DEBUG] ${mes}`);
}

module.exports = {
  debug,
  toScreen,
  toConsole
}
