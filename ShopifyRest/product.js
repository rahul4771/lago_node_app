const { shopify } = require('../Utils/shopifyConnect');

module.exports = {
  /* Getting the product by the product id. */
  getShopifyProductByProductId: async function (id) {
    const params = '';
    return await shopify.product.get(id, params);
  },
  /* Getting the count of the products in the shopify store. */
  getProductsCount: async function () {
    return await shopify.product.count();
  },
};
