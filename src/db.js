const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/db.sqlite');
const {debug} = require('./utils');
const {v4} = require('uuid');

/*
 * id - ID
 * ticker - Тикер
 * direction - Buy | Sell
 * trigger_price - Уровень срабатывания сделки
 * order_type - Тип ордера для сделки - limit | market
 * order_price - Цена ордера для сделки
 * lots - Количество лотов для сделки
 * is_executed - Флаг исполнено или нет - 0 | 1
 * type - Тип актива (сейчас: stock | currency) @todo хорошо бы переименовать в asset_type, поскольку имя "type" скорее указывает на какой-то общий тип данной сделки
 * is_limited - Флаг, указывающий на то, действуют ли общие лимиты на покупку/продажу на данную сделку - 0 | 1
 * lot - Количество бумаг в лоте
 * currency - Валюта актива
 */
const createTableDeals = () => {
  const handleErr = () => {}
  const sql = `CREATE TABLE deals (
    id TEXT,
    ticker TEXT,
    direction TEXT,
    trigger_price REAL,
    order_type TEXT,
    order_price REAL,
    lots INTEGER,
    is_executed INTEGER
  );`;
  db.run(sql, handleErr);
}

/*
 *  id - ID
 *  ticker - Тикер
 *  type - once | repeat
 *  lot - Количество бумаг в лоте
 *  currency - Валюта актива
 *
 *  open_direction - Buy | Sell
 *  open_trigger_price - Уровень срабатывания открывающей сделки
 *  open_order_type - Тип ордера для открывающей сделки - limit | market
 *  open_order_price - Цена ордера для открывающей сделки
 *  open_lots - Количество лотов для открывающей сделки
 *  open_status - not_active | active | pending | executed
 *
 *  close_direction - Buy | Sell
 *  close_trigger_price - Уровень срабатывания закрывающей сделки
 *  close_order_type - Тип ордера для закрывающей сделки - limit | market
 *  close_order_price - Цена ордера для закрывающей сделки
 *  close_lots - Количество лотов для закрывающей сделки
 *  close_status - not_active | active | pending | executed
 */
const createTablePairDeals = () => {
  const handleErr = () => {}
  const sql = `CREATE TABLE pair_deals (
    id TEXT,
    ticker TEXT,
    type TEXT,
    lot INTEGER,
    currency TEXT,
    cycles INTEGER,
    
    open_direction TEXT,
    open_trigger_price REAL,
    open_order_type TEXT,
    open_order_price REAL,
    open_lots INTEGER,
    open_status TEXT,
    
    close_direction TEXT,
    close_trigger_price REAL,
    close_order_type TEXT,
    close_order_price REAL,
    close_lots INTEGER,
    close_status TEXT
  );`;
  db.run(sql, handleErr);
}

const addColsTypeAndIsLimitedToDeals = () => {
  const handleErr = () => {}
  const sql = `
    ALTER TABLE deals
    ADD COLUMN type TEXT;
  `;
  const sql2 = `
    ALTER TABLE deals
    ADD COLUMN is_limited INTEGER;
  `;
  const sql3 = `
    ALTER TABLE deals
    ADD COLUMN lot INTEGER;
  `;
  const sql4 = `
    ALTER TABLE deals
    ADD COLUMN currency TEXT;
  `;
  db.run(sql, handleErr);
  db.run(sql2, handleErr);
  db.run(sql3, handleErr);
  db.run(sql4, handleErr);
}

const createTableSettings = () => {
  const handleErr = () => {}
  const sql = `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT
  );`;
  db.run(sql, handleErr);
}

// const addMockData = () => {
//   // insertDeal('GAZP', 'Sell', 490, 'limit', 489, 1);
//   // insertDeal('GAZP', 'Buy', 280, 'limit', 281, 1);
// }

const insertDeal = ({ticker, direction, trigger_price, order_type, order_price, lots, lot, type, is_limited, currency}) => {
  return new Promise(resolve => {
    try {
      const handleErr = (e) => {
        if (e) {
          debug(e);
          resolve(null);
        }
        resolve(true)
      }; // resolve here!
      const sql = `
        INSERT INTO deals (id, ticker, direction, trigger_price, order_type, order_price, lots, lot, is_executed, type, is_limited, currency) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?);
      `;
      const stmt = db.prepare(sql);
      const values = [v4(), ticker, direction, trigger_price, order_type, order_price, lots, lot, 0, type, is_limited, currency];
      stmt.run(values, handleErr);
      stmt.finalize();
    } catch (e) {
      debug(e);
      resolve(null);
    }
  })
}

const insertSettings = ({key, value, description}) => {
  return new Promise(resolve => {
    try {
      const handleErr = (e) => {
        if (e) {
          debug(e);
          resolve(null);
        }
        resolve(true)
      }; // resolve here!
      const sql = `
        INSERT INTO settings (key, value, description) 
        VALUES (?, ?, ?);
      `;
      const stmt = db.prepare(sql);
      const values = [key, value, description];
      stmt.run(values, handleErr);
      stmt.finalize();
    } catch (e) {
      debug(e);
      resolve(null);
    }
  })
}

const deleteDeal = (id) => {
  return new Promise(resolve => {
    try {
      const handleErr = (e) => {
        if (e) {
          debug(e);
          resolve(null);
        }
        resolve(true)
      }; // resolve here!
      const sql = `DELETE FROM deals WHERE id = ?;`;
      const stmt = db.prepare(sql);
      const values = [id];
      stmt.run(values, handleErr);
      stmt.finalize();
    } catch (e) {
      debug(e);
      resolve(null);
    }
  })
}

const deleteExecutedDeals = () => {
  return new Promise(resolve => {
    try {
      const handleErr = (e) => {
        if (e) {
          debug(e);
          resolve(null);
        }
        resolve(true)
      }; // resolve here!
      const sql = `DELETE FROM deals WHERE is_executed = 1;`;
      db.run(sql, handleErr);
    } catch (e) {
      debug(e);
      resolve(null);
    }
  })
}

// flag: 0 | 1
const updateDealIsExecuted = (id, flag) => {
  if (!(flag === 0 || flag === 1)) {
    debug(new Error());
    process.exit(1);
  }
  return new Promise((resolve) => {
    const handler = (e) => {
      if (e) {
        debug(e);
        resolve(null);
      }
      resolve(true);
    }; // resolve here!
    const sql = `UPDATE deals SET is_executed = (?) WHERE id = (?);`;
    const stmt = db.prepare(sql);
    const values = [flag, id];
    stmt.run(values, handler);
    stmt.finalize();
  })
}

const setSettingVal = (key, val) => {
  return new Promise((resolve) => {
    const handler = (e) => {
      if (e) {
        debug(e);
        resolve(null);
      }
      resolve(true);
    }; // resolve here!
    const sql = `UPDATE settings SET value = (?) WHERE key = (?);`;
    const stmt = db.prepare(sql);
    const values = [val, key];
    stmt.run(values, handler);
    stmt.finalize();
  })
}

const getAllDeals = (is_executed) => {
  return new Promise((resolve) => {
    let sql = `SELECT * FROM deals `;
      is_executed ? sql += 'WHERE is_executed = 1;' : ';'
      db.all(sql, (err, result) => {
      if (err || !result.length) resolve(null);
      resolve(result);
    })
  })
}

const getSettingByKey = (key) => {
  return new Promise((resolve) => {
    const handler = (e, data) => {
      if (e) {
        debug(e);
        resolve(null);
        return;
      }
      if (data.length) {
        resolve(data[0]);
      }
      resolve(null);
    }; // resolve here!
    const sql = `SELECT * FROM settings WHERE key = (?);`;
    const stmt = db.prepare(sql);
    const values = [key];
    stmt.all(values, handler);
    stmt.finalize();
  })
}

// direction: Buy | Sell
const getOrdersLimitSum = async (direction) => {
  if (!(direction === 'Buy' || direction === 'Sell')) {
    throw new Error();
  }
  let key;
  if (direction === 'Buy') {
    key = 'max_buy_sum';
  }
  if (direction === 'Sell') {
    key = 'max_sell_sum';
  }
  return await getSettingByKey(key);
}

const insertPairDeal = (params) => {
  return new Promise(resolve => {
    try {
      const {
        ticker, type, lot, currency, cycles,
        open_direction, open_trigger_price, open_order_type, open_order_price, open_lots, open_status,
        close_direction, close_trigger_price, close_order_type, close_order_price, close_lots, close_status
      } = params;
      const handleErr = (e) => {
        if (e) {
          debug(e);
          resolve(null);
        }
        resolve(true)
      }; // resolve here!
      const sql = `
        INSERT INTO pair_deals 
          (
            id, ticker, type, lot, currency, cycles,
            open_direction, open_trigger_price, open_order_type, open_order_price, open_lots, open_status, 
            close_direction, close_trigger_price, close_order_type, close_order_price, close_lots, close_status
          ) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
      `;
      const stmt = db.prepare(sql);
      const values = [
        v4(), ticker, type, lot, currency, cycles,
        open_direction, open_trigger_price, open_order_type, open_order_price, open_lots, open_status,
        close_direction, close_trigger_price, close_order_type, close_order_price, close_lots, close_status
      ];
      stmt.run(values, handleErr);
      stmt.finalize();
    } catch (e) {
      debug(e);
      resolve(null);
    }
  })
}

const getAllPairDeals = () => {
  return new Promise((resolve) => {
    let sql = `SELECT * FROM pair_deals;`;
    db.all(sql, (err, result) => {
      if (err || !result.length) resolve(null);
      resolve(result);
    })
  })
}

// deal_side: open | close
// status: not_active | active | pending | executed
const updatePairDealStatus = (id, deal_side, status) => {
  if (!(deal_side === 'open' || deal_side === 'close')) {
    debug(new Error());
    process.exit(1);
  }
  if (!(status === 'not_active' || status === 'active' || status === 'pending' || status === 'executed')) {
    debug(new Error());
    process.exit(1);
  }
  return new Promise((resolve) => {
    const handler = (e) => {
      if (e) {
        debug(e);
        resolve(null);
      }
      resolve(true);
    }; // resolve here!
    let side_field;
    if (deal_side === 'open') side_field = 'open_status';
    if (deal_side === 'close') side_field = 'close_status';
    const sql = `UPDATE pair_deals SET ${side_field} = (?) WHERE id = (?);`;
    const stmt = db.prepare(sql);
    const values = [status, id];
    stmt.run(values, handler);
    stmt.finalize();
  })
}

const dbActions = async () => {
  createTableDeals();
  createTablePairDeals();
  createTableSettings();
  addColsTypeAndIsLimitedToDeals();
  const f1 = async () => {
    const r1 = await getSettingByKey('active_acc');
    if (!r1) await insertSettings({key: 'active_acc', value: null});
  }
  const f2 = async () => {
    const r2 = await getSettingByKey('max_buy_sum');
    if (!r2) await insertSettings({key: 'max_buy_sum', value: null});
  }
  const f3 = async () => {
    const r3 = await getSettingByKey('max_sell_sum');
    if (!r3) await insertSettings({key: 'max_sell_sum', value: null});
  }
  await Promise.all([f1(), f2(), f3()]);
}

db.serialize(() => {
  debug('База данных сериализована');
  dbActions();
});

module.exports = {
  db,
  getAllDeals,
  updateDealIsExecuted,
  insertDeal,
  deleteDeal,
  deleteExecutedDeals,
  setSettingVal,
  getSettingByKey,
  getOrdersLimitSum,
  insertPairDeal,
  getAllPairDeals,
  updatePairDealStatus
};
