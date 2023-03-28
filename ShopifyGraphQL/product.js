module.exports = {
  // Query to read products Id
  getProductsIds: function (queryParam = null) {
    return `{
      products(${queryParam ? queryParam : 'first:10, reverse:true'}) {
          pageInfo {
              hasNextPage
          }
          edges {
              cursor
              node {
                  id
              }
          }
      }
  }`;
  },
  // Query to get vendor of products in shopify
  getProductsAllVendors: function () {
    return `query productVendors {
      shop {
          productVendors(first: 250) {
              edges {
                  node
              }
          }
      }
    }`;
  },
  // Query to get type of products in shopify
  getProductsAllTypes: function () {
    return `query productTypes {
      shop {
          productTypes(first: 250) {
              edges {
                  node
              }
          }
      }
    }`;
  },
  // Query to get all products and its variants price
  getAllProductsAndVariants: function (queryParam = null) {
    return `{
      products(${queryParam ? queryParam : 'first:10, reverse:true'}) {
          pageInfo {
              hasNextPage
              hasPreviousPage
          }
          edges {
              cursor
              node {
                  id
                  handle
                  title
                  variants(first:20){
                      edges {
                          node{
                              price
                              inventoryQuantity
                          }
                      }
                  }
                  featuredImage{
                      transformedSrc
                  }
                  featuredMedia {
                        mediaContentType
                        preview {
                            image {
                                transformedSrc(maxWidth: 360)
                            }
                        }
                    }
              }
          }
      }
  }`;
  },
};
