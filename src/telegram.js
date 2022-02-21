require('dotenv').config();
const axios = require('axios');
const {debug, toScreen, pause} = require('./utils');
const API_KEY = process.env.TG_BOT_API_KEY;
const URL = `https://api.telegram.org/bot${API_KEY}`;
const root = require('app-root-path');
const {name} = require(`${root}/package.json`);

// https://core.telegram.org/bots/api#sendmessage
// returns true if request successful, false if error
const sendMes = async ({userID, mes, parseMode, disableLinkPreview, forceReply}) => {
  if (!API_KEY) return;
  const data = {
    chat_id: userID,
    text: mes
  }
  if (forceReply) data.reply_markup = {force_reply: true};
  if (parseMode) data.parse_mode = parseMode;
  if (disableLinkPreview) data.disable_web_page_preview = true;
  const urlFull = `${URL}/sendMessage`;
  try {
    await axios.post(urlFull, data);
    return true;
  } catch (e) {
    toScreen(`Ошибка при отправке запроса на ${urlFull}`, 'e');
    debug(e);
    return false;
  }
}

const toTelegram = async (mes) => {
  if (!process.env.TG_ADMIN_USER_ID) return;
  let message = `${name}\n`;
  if (process.env.ENV_ID) {
    message += `Env: ${process.env.ENV_ID}\n`;
  }
  message += `\n`;
  message += mes;
  return await sendMes({
    userID: process.env.TG_ADMIN_USER_ID,
    mes: message,
    disableLinkPreview: true
  })
}

const sendMessagesToAdminOneByOne = async (messagesArray, interval = 2000) => {
  for (let i = 0; i < messagesArray.length; i++) {
    await toTelegram(messagesArray[i]);
    await pause(interval);
  }
}

module.exports = {
  sendMes,
  toTelegram,
  sendMessagesToAdminOneByOne
}
