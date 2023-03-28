module.exports = {
  // Query to read draft orders
  getDraftOrders: function (queryParam = null) {
    return `{
      draftOrders(${queryParam ? queryParam : 'first:100, reverse:true'}) {
          pageInfo {
              hasNextPage
              hasPreviousPage
          }
          edges {
              cursor
              node {
                  id
                  name
                  email
                  tags
                  createdAt
                  totalPrice
                  customer {
                      id
                      displayName
                  }
              }
          }
      }
    }`;
  },
  // Query to read draft order ids
  getDraftOrdersIds: function (queryParam = null) {
    return `{
      draftOrders(${queryParam}) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
        edges {
          cursor
          node {
            id
            name
            totalPrice
            tags
            lineItems(first: 1) {
              edges {
                node {
                  product{
                    id
                  }
                }
              }
            }										
          }
        }
      }
    }`;
  },
  // Query to get draft order by its Id
  getShopifyDraftOrderById: function (queryParam = null) {
    return `{
      draftOrders(${queryParam ? queryParam : 'first:100, reverse:true'}) {
        pageInfo { 
            hasNextPage 
            hasPreviousPage 
        }
        edges {
          node {
            id
            name
            email
            tags
            note2
            createdAt
            subtotalPrice
            totalShippingPrice
            totalTax
            totalPrice
            invoiceUrl
            billingAddress {
              address1
              address2
              name
              phone
              city
              province
              country
              zip
            }
            shippingAddress {
              address1
              address2
              name
              phone
              city
              province
              country
              zip
            }
            lineItems(first: 20) {
              edges {
                node {
                  id
                  name
                  quantity
                  product{
                    id
                    title
                  }
                  variant{
                    id
                    title
                    selectedOptions{
                      name
                      value
                    }
                    price
                  }
                }
              }
            }
            totalPrice
            customer {
              id
              displayName
              email
              tags
              defaultAddress{
                address1
                address2
                name
                city
                country
                province
                zip
                phone
              }
            }
            metafield(namespace: "global", key: "customization_details") {
              id
              key
              value
            }
          }
        }
      }
    }`;
  },
  // Query to get draft order by its Id
  getAllDraftOrders: function (queryParam = null) {
    return `{
        draftOrders(${queryParam}) {
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        edges {
          cursor
          node {
            id
            name
            email
            tags
            lineItems(first: 20) {
              edges {
                node {
                  id
                  name
                  quantity
                  product{
                    id
                    title
                  }
                  variant{
                    id
                    title
                    selectedOptions{
                      name
                      value
                    }
                    price
                  }
                }
              }
            }
            totalPrice
            customer {
                id
                displayName
                email
                tags
            }
          }
        }
      }
      }`;
  },
  // Query to read draft order ids
  getDraftOrderById: function (queryParam = null) {
    return `{
        draftOrders(${queryParam ? queryParam : 'first:100, reverse:true'}) {
            pageInfo {
                hasNextPage
            }
            edges {
                cursor
                node {
                    id
                    name
                    totalPrice
                }
            }
        }
      }`;
  },
};
