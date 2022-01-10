const store = {
  stocksRaw: null,
  currenciesRaw: null,
  activeStocksByTicker: {},
  activeStocksByFigi: {},
  tickersList: null,
  accounts: null,
  activeAcc: null,
  portfolio: {},
  sumOrdersBuyActivatedRUB: 0,
  sumOrdersSellActivatedRUB: 0,
  ordersActivateLimit: {
    Buy: null,
    Sell: null,
  },
  portfolioCurrencies: {},
  currencies: {
    USD: {
      figi: 'BBG0013HGFT4',
      price: null, // last price in candles or mid(best_bed, best_ask)
      best_bid: null,
      best_ask: null,
      trade_status: null
    },
    EUR: {
      figi: 'BBG0013HJJ31',
      price: null, // last price in candles or mid(best_bed, best_ask)
      best_bid: null,
      best_ask: null,
      trade_status: null
    }
  }
}

module.exports = store;
