require('dotenv').config();
const axios = require('axios');
const {debug, toScreen} = require('./utils');
const API_KEY = process.env.TG_BOT_API_KEY;
const URL = `https://api.telegram.org/bot${API_KEY}`;

// https://core.telegram.org/bots/api#sendmessage
// returns true if request successful, false if error
const sendMes = async ({userID, mes, parseMode, disableLinkPreview, forceReply}) => {
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
  return await sendMes({
    userID: process.env.TG_ADMIN_USER_ID,
    mes,
    disableLinkPreview: true
  })
}

module.exports = {
  sendMes,
  toTelegram
}
