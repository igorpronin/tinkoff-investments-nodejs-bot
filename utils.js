require('dotenv').config();
const chalk = require('chalk');
const {sendMes} = require('./telegram');

// level: 'w' | 'e'
const toScreen = (message, level) => {
  const warning = chalk.bold.bgYellow.black;
  const error = chalk.bold.bgRed.white;
  let mes = message;
  if (level === 'w') mes = ` ${warning(mes)} `;
  if (level === 'e') mes = ` ${error(mes)} `;
  console.log(mes);
}

const toTelegram = async (mes) => {
  return await sendMes({
    userID: process.env.TG_ADMIN_USER_ID,
    mes,
    disableLinkPreview: true
  })
}

const debug = (mes) => {
  if (process.env.DEBUG === '1') console.log(mes);
}

module.exports = {
  debug,
  toScreen,
  toTelegram
}
