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

const addMockData = () => {
  insertDeal('GAZP', 'Sell', 490, 'limit', 489, 1);
  insertDeal('GAZP', 'Buy', 280, 'limit', 281, 1);
}

const insertDeal = (ticker, direction, trigger_price, order_type, order_price, lots) => {
  const handleErr = (err) => {
    if (err) console.log(err);
  };
  const sql = `
    INSERT INTO deals (id, ticker, direction, trigger_price, order_type, order_price, lots, is_executed) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const stmt = db.prepare(sql);
  const values = [v4(), ticker, direction, trigger_price, order_type, order_price, lots, 0];
  stmt.run(values, handleErr);
  stmt.finalize();
}

const markDealAsExecuted = (id) => {
  return new Promise((resolve, reject) => {
    const handleErr = (err) => {
      if (err) console.log(err);
    };
    const sql = `UPDATE deals SET is_executed = 1 WHERE id = (?);`;
    const stmt = db.prepare(sql);
    const values = [id];
    stmt.run(values, handleErr);
    stmt.finalize();
    resolve(true);
  })
}

const getAllDeals = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM deals;`;
      db.all(sql, (err, result) => {
      if (err || !result.length) resolve(null);
      resolve(result);
    })
  })
}

const dbActions = async () => {
  createTableDeals();
  // addMockData();
}

db.serialize(() => {
  debug('База данных сериализована');
  dbActions();
});

module.exports = {
  db,
  getAllDeals,
  markDealAsExecuted
};
