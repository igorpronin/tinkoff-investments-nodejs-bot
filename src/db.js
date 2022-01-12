const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/db.sqlite');
const {debug} = require('./utils');
const {v4} = require('uuid');

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
      };
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
      };
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
      };
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
      };
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
    };
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
    };
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
    };
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

const dbActions = async () => {
  createTableDeals();
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
  getOrdersLimitSum
};
