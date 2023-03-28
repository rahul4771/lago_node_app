module.exports = {
  // Query to get orders from Shopify
  getOrders: function () {
    return `{
      orders(${queryParam ? queryParam : 'first: 100, reverse:true'}) {
          edges {
              cursor
              node {
                  id
                  name
              }
          }
      }
    }`;
  },
};
