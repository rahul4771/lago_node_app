
const { shopify, shopify2 } = require('../Utils/shopifyConnect');
const errorCodes = {
    throttle: 'THROTTLED',
  };
  

module.exports = {
  /**
   * @description get data from shopify using graphQL
   * If the first shopify instance fails, try the second shopify instance
   * @param query - The query you want to run.
   * @returns The result of the graphql query.
   */
  graphQlGet: async function (query) {
    let error = '';
    do {
      try {
        return await shopify.graphql(query);
      } catch (e) {
        if (e.extensions.code == errorCodes.throttle) {
          try {
            return await shopify2.graphql(query);
          } catch (err) {
            error = err;
          }
        }
      }
    } while (error.extensions.code == errorCodes.throttle);
  },
};
