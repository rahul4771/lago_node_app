module.exports = {
  // Query to read customers
  getCustomerData: function (queryParam = null) {
    return `{
        customers(${queryParam ? queryParam : 'first:10, reverse:true'}) {
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
          edges {
            cursor
            node {
              id
              email
              displayName
              totalSpent
            }
          }
        }
      }`;
  },
  getAllShopifyCustomers: function (queryParam = null) {
    return `{
      customers(${queryParam ? queryParam : 'first:10, reverse:true'}) {
          pageInfo {
              hasNextPage
              hasPreviousPage
          }
          edges {
              cursor
              node {
                  id
                  email
                  displayName
                  addresses {

                      address1
                      address2
                      city
                      province
                      country
                      zip
                      phone
                  }
                  defaultAddress {

                      address1
                      address2
                      city
                      province
                      country
                      zip
                      phone
                  }
                  totalSpent
                  ordersCount
              }
          }
      }
  }`;
  },
  // Query to create customer in shopify
  createCustomer: function (data = []) {
    return `mutation {
        customerCreate(input: { email: "${data.email}", firstName: "${data.firstName}", lastName: "${data.lastName}" }) {
          customer {
            id
          }
        }
      }`;
  },
  // Query to get multiple customers by id
  getMultipleCustomerById: function (ids) {
    return `{
      nodes( ids: [ ${ids} ]) {
          ...on Customer {
              id
              displayName
              email
          }
      }
  }`;
  },
};
