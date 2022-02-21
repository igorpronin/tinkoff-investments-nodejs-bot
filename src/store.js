const store = {
  stocksRaw: null,
  currenciesRaw: null,
  availableCurrenciesList: ['USDRUBTOM', 'EURRUBTOM'],

  // Объект для хранения данных по акциям, по которым есть сделки
  // ключи по тикеру
  activeStocksByTicker: {},

  // Объект для хранения данных по акциям, по которым есть сделки
  // ключи по FIGI, объект содержит ссылки на акции, добавленные ранее в activeStocksByTicker, НЕ клон
  activeStocksByFigi: {},

  tickersList: null,
  accounts: null,
  activeAcc: null, // текущий аккаунт для работы
  portfolio: {},
  hasPendingPairDeals: false, // если есть сделки в статусе 'pending', новые сделки не открывать!
  pendingOrdersByPairDeals: new Set(),
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
      trade_status: null,
      deals: []
    },
    EUR: {
      figi: 'BBG0013HJJ31',
      price: null, // last price in candles or mid(best_bed, best_ask)
      best_bid: null,
      best_ask: null,
      trade_status: null,
      deals: []
    }
  }
}

module.exports = store;
