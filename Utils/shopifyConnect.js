const Shopify = require('shopify-api-node');

const shopify = new Shopify({
  shopName: process.env.SHOPIFY_DOMAIN,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD,
});

const shopify2 = new Shopify({
  shopName: process.env.SHOPIFY_DOMAIN2,
  apiKey: process.env.SHOPIFY_API_KEY2,
  password: process.env.SHOPIFY_API_PASSWORD2,
});

module.exports = { shopify, shopify2 };
