require('dotenv').config();
const chalk = require('chalk');

// level: 'w' | 'e' | 's'
const toScreen = (message, level) => {
  const warning = chalk.bold.bgYellow.black;
  const error = chalk.bold.bgRed.white;
  const success = chalk.bold.bgGreen.white;
  let mes = message;
  if (level === 'w') mes = `${warning(mes)}`;
  if (level === 'e') mes = `${error(mes)}`;
  if (level === 's') mes = `${success(mes)}`;
  console.log(mes);
}

const debug = (mes) => {
  if (process.env.DEBUG === '1') console.log(mes);
}

module.exports = {
  debug,
  toScreen
}
