const { shopify } = require('../Utils/shopifyConnect');

module.exports = {
  /* This is a function that is getting a customer by their id. */
  getShopifyCustomerById: async function (id) {
    return await shopify.customer.get(id);
  },
  /* This is a function that is getting the count of all the customers in the shopify store. */
  getCustomersCount: async function () {
    return await shopify.customer.count();
  },

  /* This is a function that is updating a customer by their id. */
  updateShopifyCustomer: async function (id, data) {
    return await shopify.customer.update(id, data);
  },

  /* This is a function that is deleting a customer by their id. */
  deleteShopifyCustomer: async function (id) {
    return await shopify.customer.delete(id);
  },
};
