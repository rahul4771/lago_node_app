const { shopify } = require('../Utils/shopifyConnect');

module.exports = {
  /* This is a function that is updating the draft order. */
  updateShopifyDraftOrder: async function (id, data) {
    return await shopify.draftOrder.update(id, data);
  },
  /* This is a function that is getting the draft order by id. */
  getShopifyDraftOrderById: async function (id, params) {
    return await shopify.draftOrder.get(id, params);
  },
  /* This is a function that is creating a draft order. */
  createShopifyDraftOrder: async function (data) {
    return await shopify.draftOrder.create(data);
  },
  /* This is a function that is getting the draft order count. */
  getDraftOrdersCount: async function () {
    return await shopify.draftOrder.count();
  },
  /* This is a function that is getting the draft order metafields. */
  getDraftOrderMetafields: async function (id) {
    return await shopify.metafield.list({
      metafield: { owner_resource: 'draft_order', owner_id: id },
    });
  },
  /* This is a function that is updating the metafield. */
  updateMetafield: async function (id, data) {
    return shopify.metafield.update(id, data);
  },
};
