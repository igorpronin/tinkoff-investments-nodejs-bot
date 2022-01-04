require('dotenv').config();

const {toScreen, debug} = require('./src/utils');
const {version, name} = require('./package.json');
toScreen(`${name}, version: ${version}`, 's');

const inquirer = require('inquirer');
const {ask: runConfig, } = require('./src/configure');
const {runMain} = require('./src/main');
// const {db} = require('./src/db');

// Возвращает флаг, который используется для того, чтобы управлять перезапуском меню
const handleAction = async (answer) => {
  switch (answer) {
    case 'run_config':
      await runConfig();
      return true;
    case 'run_main':
      await runMain();
      return false;
    case 'close':
      console.log('Завершено!');
      process.exit();
      break;
  }
}

const ask = async () => {
  const actions = {
    type: 'list',
    name: 'action',
    message: 'Что сделать?',
    choices: [
      {
        name: 'Настроить',
        value: 'run_config'
      },
      {
        name: 'Запустить скрипт',
        value: 'run_main'
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
    const reRun = await handleAction(answers.action);
    if (reRun) await ask();
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

if (process.env.FORCE_START === '1') {
  runMain()
} else {
  ask();
}


