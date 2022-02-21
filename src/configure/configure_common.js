require('dotenv').config();
const inquirer = require('inquirer');
const {debug, toScreen} = require('../utils');
const store = require('../store');
const {setSettingVal} = require('../db');
const {setCurrentAccount} = require('../api');

const setAcc = async () => {
  toScreen('Установка счета для торговли...', 'w');
  const choices = [];
  const q1 = [
    {
      type: 'list',
      name: 'accID',
      message: 'Аккаунт',
      choices
    }
  ]
  store.accounts.forEach(acc => {
    choices.push({
      value: acc.brokerAccountId,
      name: `${acc.brokerAccountType}, ${acc.brokerAccountId}`
    })
  })
  let {accID} = await inquirer.prompt(q1);
  setCurrentAccount(accID);
  store.activeAcc = accID;
  await setSettingVal('active_acc', accID);
  toScreen(`Активный счет ${accID} установлен.`, 's');
}

const handleAction = async (answer) => {
  switch (answer) {
    case 'set_acc':
      await setAcc();
      await askConfigCommon();
      break;
    case 'close':
      toScreen('Завершено!');
      process.exit();
      break;
  }
}

const askConfigCommon = async () => {
  const actions = {
    type: 'list',
    name: 'action',
    message: 'Что сделать?',
    choices: [
      {
        name: 'Выбрать счет для торговли',
        value: 'set_acc'
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
      // Prompt couldn't be rendered in the current environment
    } else {
      // Something else went wrong
    }
  }
}

module.exports = {
  askConfigCommon
};
