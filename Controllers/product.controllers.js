require('dotenv').config();
const loggerTrack = require('../Utils/log');
const { graphQlGet } = require('../Utils/graphQLCallManager');
const shopifyGraphQL = require('../ShopifyGraphQL/product');
const ShopifyProductRest = require('../ShopifyRest/product');

// get product by id
const getShopifyProductById = async function (req, res) {
  const logger = loggerTrack('product/getShopifyProductById');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`customer id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'product id is required',
      },
    });
  } else {
    const productId = req.params.id;
    const productById = await ShopifyProductRest.getShopifyProductByProductId(
      productId,
    );
    if (productById && productById !== null) {
      const result = {
        id: productById['id'],
        title: productById['title'],
        handle: productById['handle'],
        tags: productById['tags'],
        variants: productById['variants'],
        options: productById['options'],
        images: productById['images'],
        image: productById['image'],
      };
      const responseResult = {
        message: 'success',
        body: { product: result },
      };
      logger.info(
        `successfully fetch product by id :- ${JSON.stringify(responseResult)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(responseResult);
    } else {
      logger.debug(`Failed to get the product details`);
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to get the product details',
        },
      });
    }
  }
};

// get product product
const getProducts = async function (req, res) {
  const logger = loggerTrack('product/getProducts');
  logger.info('------------start--------------');
  let pageType = 'next';
  let cursor = null;
  let queryString = null;
  let productType = null;
  let vendor = null;
  let sort = null;
  if (Object.keys(req.query).length !== 0) {
    if (req.query.previous !== undefined) {
      pageType = 'previous';
      cursor = req.query.previous;
    }
    if (req.query.next !== undefined) {
      pageType = 'next';
      cursor = req.query.next;
    }
    if (req.query['product-type'] !== undefined) {
      productType = req.query['product-type'];
    }
    if (req.query.vendor !== undefined) {
      vendor = req.query.vendor;
    }
    if (req.query['sort-by'] !== undefined) {
      sort = req.query['sort-by'];
    }
    if (req.query.query !== undefined) {
      queryString = req.query.query;
    }
  }
  let previousCursor = null;
  let nextCursor = null;
  let result = [];
  const productDetails = await getShopifyProducts(
    cursor,
    pageType,
    queryString,
    productType,
    vendor,
    sort,
  );
  if (productDetails && productDetails.products !== undefined) {
    const pageInfo = productDetails.products.pageInfo;
    const shProducts = productDetails.products.edges;
    if (shProducts) {
      for (let i = 0; i < shProducts.length; i++) {
        if (i == 0 && pageInfo.hasPreviousPage === true) {
          previousCursor = shProducts[i].cursor;
        } else if (
          i + 1 == shProducts.length &&
          pageInfo.hasNextPage === true
        ) {
          nextCursor = shProducts[i].cursor;
        }
        const productId = shProducts[i].node.id.split('/').pop();
        if (Object.keys(shProducts[i].node.variants.edges).length == 0) {
          shProducts[i].node.variants.edges[0].node.price = null;
        }
        let productStockQuantity = 0;
        shProducts[i].node.variants.edges.forEach((variants) => {
          productStockQuantity += variants.node.inventoryQuantity;
        });
        let productStatusFlag = productStockQuantity >=1 ? true : false;
        result[i] = {
          id: productId,
          name: shProducts[i].node.title,
          handle: shProducts[i].node.handle,
          price: shProducts[i].node.variants.edges[0].node.price,
          image: (shProducts[i].node.featuredMedia ? shProducts[i].node.featuredMedia.preview.image.transformedSrc : null),
          stock: productStatusFlag,
        };
      }
      const responseResult = {
        message: 'success',
        body: {
          products: result,
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the products :- ${JSON.stringify(
          responseResult,
        )}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(responseResult);
    } else {
      result = {
        message: 'success',
        body: {
          products: [],
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the products :- ${JSON.stringify(result)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(result);
    }
  } else {
    logger.debug(`Failed to get the products`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to get the products',
      },
    });
  }
};

//To get all the types and vendors of product
const getProductTypeAndVendors = async function (req, res) {
  let vendorReturnData = [];
  let typeReturnData = [];
  let vendorResult = [];
  let typeResult = [];
  const logger = loggerTrack('product/getProductTypeAndVendors');
  logger.info('------------start--------------');
  const productVendors = await getProductsAllVendors();
  const productTypes = await getProductsAllTypes();
  if (productVendors != null) {
    for (let i = 0; i < productVendors.length; i++) {
      vendorResult[i] = {
        name: productVendors[i].node,
      };
    }
    vendorReturnData = vendorResult;
    const returnData = { message: 'success', body: { vendor: vendorResult } };
    logger.info(
      `Successfully fetched the products vendor :- ${JSON.stringify(
        returnData,
      )}`,
    );
    logger.info('------------end--------------');
  } else {
    vendorResult = [];
    returnData = { message: 'success', body: { vendor: [] } };
    logger.info(`Empty product vendors`);
    logger.info('------------end--------------');
  }
  if (productTypes != null) {
    for (let i = 0; i < productTypes.length; i++) {
      typeResult[i] = {
        name: productTypes[i].node,
      };
    }
    typeReturnData = typeResult;
    const returnData = { message: 'success', body: { type: typeResult } };
    logger.info(
      `Successfully fetched the products type :- ${JSON.stringify(returnData)}`,
    );
    logger.info('------------end--------------');
  } else {
    typeResult = [];
    returnData = { message: 'success', body: { type: [] } };
    logger.info(`Empty products types`);
    logger.info('------------end--------------');
  }
  const returnResult = {
    message: 'success',
    body: { vendor: vendorReturnData, type: typeReturnData },
  };
  logger.info(
    `Successfully fetched the products type :- ${JSON.stringify(returnResult)}`,
  );
  logger.info('------------end--------------');
  return res.status(200).json(returnResult);
};

// get vendor of products in shopify
async function getProductsAllVendors() {
  try {
    const result = await graphQlGet(shopifyGraphQL.getProductsAllVendors());
    return result['shop']['productVendors']['edges'];
  } catch (e) {
    return null;
  }
}

// get type of products in shopify
async function getProductsAllTypes() {
  try {
    const result = await graphQlGet(shopifyGraphQL.getProductsAllTypes());
    return result['shop']['productTypes']['edges'];
  } catch (e) {
    return null;
  }
}

// get products from shopify
async function getShopifyProducts(
  cursor,
  pageType,
  queryString,
  productType,
  vendor,
  sort,
) {
  let arguments = 'first:8,';
  switch (sort) {
    case 'created-desc':
      arguments += `reverse:true,sortKey:CREATED_AT`;
      break;
    case 'created-asc':
      arguments += `reverse:false,sortKey:CREATED_AT`;
      break;
    case 'updated-desc':
      arguments += `reverse:true,sortKey:UPDATED_AT`;
      break;
    case 'updated-asc':
      arguments += `reverse:false,sortKey:UPDATED_AT`;
      break;
    case 'name-desc':
      arguments += `reverse:true,sortKey:TITLE`;
      break;
    case 'name-asc':
      arguments += `reverse:false,sortKey:TITLE`;
      break;
    default:
      arguments += `reverse:true,sortKey:CREATED_AT`;
  }
  if (cursor) {
    if (pageType === 'next') {
      arguments += `, after:"${cursor}"`;
    } else if (pageType === 'previous') {
      arguments = 'last:8,';
      switch (sort) {
        case 'created-desc':
          arguments += `reverse:true,sortKey:CREATED_AT`;
          break;
        case 'created-asc':
          arguments += `reverse:false,sortKey:CREATED_AT`;
          break;
        case 'updated-desc':
          arguments += `reverse:true,sortKey:UPDATED_AT`;
          break;
        case 'updated-asc':
          arguments += `reverse:false,sortKey:UPDATED_AT`;
          break;
        case 'name-desc':
          arguments += `reverse:true,sortKey:TITLE`;
          break;
        case 'name-asc':
          arguments += `reverse:false,sortKey:TITLE`;
          break;
        default:
          arguments += `reverse:true,sortKey:CREATED_AT`;
      }
      arguments += `, before:"${cursor}"`;
    }
  }
  if (queryString || productType || vendor) {
    arguments += ', query:"-status:ARCHIVED AND ';
    let queryParam = '';
    if (queryString) {
      queryParam += `title:*${queryString}*`;
    }
    if (productType) {
      queryParam +=
        queryParam != ''
          ? ` AND product_type:${productType}`
          : `product_type:${productType}`;
    }
    if (vendor) {
      queryParam +=
        queryParam != '' ? ` AND vendor:${vendor}` : `vendor:${vendor}`;
    }
    arguments = arguments + queryParam + '"';
  } else{
    arguments += ', query:"-status:ARCHIVED"';
  }

  try {
    const result = await graphQlGet(
      shopifyGraphQL.getAllProductsAndVariants(arguments),
    );
    return result;
  } catch (e) {
    return null;
  }
}
module.exports = {
  getProducts,
  getShopifyProductById,
  getProductTypeAndVendors,
};
