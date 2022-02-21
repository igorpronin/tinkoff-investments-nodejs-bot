const {askConfigDeals, showTotalsActive} = require('./configure_deals');
const {askConfigCommon} = require('./configure_common');
const {askConfigPairDeals} = require('./configure_pair_deals');

module.exports = {
  askConfigDeals,
  askConfigPairDeals,
  askConfigCommon,
  showTotalsActive
};
