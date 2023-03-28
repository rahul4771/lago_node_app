require('dotenv').config();
const moment = require('moment');
const { fileUpload } = require('../Utils/fileUpload');
const artWorkModel = require('../Models/artwork');
const draftOrderModel = require('../Models/draftOrder');
const ucfirst = require('ucfirst');
const validate = require('../validators/draftOrderValidator');
const Klaviyo = require('klaviyo-node');
const klaviyoClient = new Klaviyo(process.env.KLAVIYO_KEY);
const adminEmail = process.env.ADMIN_EMAIL;
const adminName = process.env.ADMIN_NAME;
const loggerTrack = require('../Utils/log');
const { graphQlGet } = require('../Utils/graphQLCallManager');
const shopifyDraftOrderGraphQL = require('../ShopifyGraphQL/draftOrder');
const shopifyCustomerGraphQL = require('../ShopifyGraphQL/customer');
const constants = require('../Utils/constants');
const ShopifyDraftOrderRest = require('../ShopifyRest/draftOrder');
const ShopifyCustomerRest = require('../ShopifyRest/customer');
const ShopifyProductRest = require('../ShopifyRest/product');
const isFirstCharNum = (str) => str.match(new RegExp(/^\d/)) !== null;

// Get draft orders
const getDraftOrders = async function (req, res) {
  const logger = loggerTrack('draftOrder/getDraftOrders');
  logger.info('------------start--------------');
  let pageType = 'next';
  let cursor = null;
  let createdBy = null;
  let queryString = null;
  if (Object.keys(req.query).length !== 0) {
    if (req.query.previous !== undefined) {
      pageType = 'previous';
      cursor = req.query.previous;
    }
    if (req.query.next !== undefined) {
      pageType = 'next';
      cursor = req.query.next;
    }
    if (req.query.query !== undefined) {
      queryString = req.query.query;
    }
    if (req.query['created-by'] !== undefined) {
      createdBy = req.query['created-by'];
    }
  }
  let previousCursor = null;
  let nextCursor = null;
  let result = [];
  const loggedCustomerId = req.user.id;
  const loggedCustomerRole = req.user.role;
  let draftOrderDetails = null;
  if (loggedCustomerRole == constants.roles.customer) {
    draftOrderDetails = await getDraftOrdersFromShopify(
      cursor,
      pageType,
      queryString,
      createdBy,
      loggedCustomerId,
      loggedCustomerId,
      loggedCustomerRole,
    );
  } else if (loggedCustomerRole == constants.roles.salesRep) {
    draftOrderDetails = await getDraftOrdersFromShopify(
      cursor,
      pageType,
      queryString,
      createdBy,
      loggedCustomerId,
      loggedCustomerId,
      loggedCustomerRole,
    );
  } else {
    draftOrderDetails = await getDraftOrdersFromShopify(
      cursor,
      pageType,
      queryString,
      createdBy,
    );
  }
  if (draftOrderDetails && draftOrderDetails.draftOrders !== undefined) {
    const pageInfo = draftOrderDetails.draftOrders.pageInfo;
    const draftOrders = draftOrderDetails.draftOrders.edges;
    if (draftOrders) {
      let artIds = [];
      let salesRepsIds = [];
      let salesReps = {};
      for (let i = 0; i < draftOrders.length; i++) {
        if (i == 0 && pageInfo.hasPreviousPage === true) {
          previousCursor = draftOrders[i].cursor;
        } else if (
          i + 1 == draftOrders.length &&
          pageInfo.hasNextPage === true
        ) {
          nextCursor = draftOrders[i].cursor;
        }
        const order = draftOrders[i].node;
        const orderId = order.id.split('/').pop();
        const orderLineItems = order.lineItems.edges;
        let customerData = {};
        const orderTags = order.tags;
        let orderSalesRepId = null;
        orderTags.forEach((orderTag) => {
          if (orderTag.includes('createdBy:salesRep')) {
            orderSalesRepId = orderTag.split(':').pop();
          }
        });
        if (order.customer !== null) {
          customerData['id'] = order.customer.id.split('/').pop();
          customerData['name'] = order.customer.displayName;
          customerData['email'] = order.customer.email;
          customerData['sales_rep_id'] = null;

          if (order.customer.tags) {
            let customerTagArray = order.customer.tags;
            customerTagArray.forEach((custTag) => {
              if (custTag.includes('salesRep')) {
                let saleRepId = custTag.split(':').pop();
                customerData['sales_rep_id'] = saleRepId;
                if (salesRepsIds.includes(saleRepId) === false) {
                  salesRepsIds.push(saleRepId);
                }
              }
            });
          }
        }
        if (Object.keys(customerData).length == 0) {
          customerData = null;
        }
        const lineItems = await getLineItems(orderId, orderLineItems);
        result[i] = {
          id: orderId,
          name: order.name,
          email: order.email,
          line_items: lineItems,
          total_price: order.totalPrice,
          customer: customerData,
          orderSalesRepId: orderSalesRepId,
        };
        const tagArray = order.tags;
        tagArray.forEach((tag) => {
          if (tag.includes('artworkID')) {
            const artId = tag.split(':').pop();
            artIds.push(artId);
          }
        });
      }
      // get salesrep details
      const salesRepDetails = await getMultipleCustomerById(salesRepsIds);
      if (salesRepDetails != '') {
        for (let i = 0; i < salesRepDetails.nodes.length; i++) {
          if (salesRepDetails.nodes[i] != null) {
            const id = salesRepDetails.nodes[i].id.split('/').pop();
            salesReps[id] = salesRepDetails.nodes[i].displayName;
          }
        }
      }
      // get artwork names from database
      if (artIds !== undefined || artIds.length > 0) {
        artIds = artIds.join("','");
        artWorkModel.getArtworksByIds(artIds, (err, arts) => {
          if (arts != null) {
            let artwork = {};
            for (let k = 0; k < arts.length; k++) {
              artwork[arts[k].id] = arts[k].artwork_name;
            }
            return res.status(200).json({
              message: 'success',
              body: {
                purchase_orders: result,
                artwork: artwork,
                sales_reps: salesReps,
                next_cursor: nextCursor,
                previous_cursor: previousCursor,
              },
            });
          } else {
            return res.status(200).json({
              message: 'success',
              body: {
                purchase_orders: result,
                artwork: {},
                sales_reps: salesReps,
                next_cursor: nextCursor,
                previous_cursor: previousCursor,
              },
            });
          }
        });
      } else {
        return res.status(200).json({
          message: 'success',
          body: {
            purchase_orders: result,
            artwork: {},
            sales_reps: salesReps,
            next_cursor: nextCursor,
            previous_cursor: previousCursor,
          },
        });
      }
    } else {
      return res.status(200).json({
        message: 'success',
        body: {
          purchase_orders: [],
          artwork: {},
          sales_reps: {},
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      });
    }
  } else {
    result = {
      message: 'success',
      body: {
        purchase_orders: [],
        artwork: {},
        sales_reps: {},
        next_cursor: nextCursor,
        previous_cursor: previousCursor,
      },
    };
    logger.debug(`Failed to get the order details`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to get the order details',
      },
    });
  }
};

// get order line items and fetching line item properties
async function getLineItems(orderId, orderLineItems) {
  let lineItems = {};
  if (orderLineItems) {
    const orderById = await ShopifyDraftOrderRest.getShopifyDraftOrderById(
      orderId,
    );
    const tags = orderById.tags;
    const tagArray = tags.split(',');
    for (let j = 0; j < orderLineItems.length; j++) {
      let items = orderLineItems[j].node;
      let productId = items.product.id.split('/').pop();
      if (!(productId in lineItems)) {
        let status = '';
        let requiredBy = '';
        tagArray.forEach((tag) => {
          if (tag.includes('requiredBy')) {
            requiredBy = tag.split(':').pop();
          }
          if (tag.includes(productId)) {
            status = tag.split(':').pop();
          }
        });
        lineItems[productId] = {};
        lineItems[productId]['product_name'] = items.product.title;
        lineItems[productId]['status'] = status;
        lineItems[productId]['required_by'] = requiredBy;
        lineItems[productId]['items'] = [
          {
            id: items.id.split('/').pop(),
            title: items.variant.title,
            quantity: items.quantity,
            price: items.variant.price,
            variant_id: items.variant.id.split('/').pop(),
            options: items.variant.selectedOptions,
          },
        ];
      } else {
        lineItems[productId]['items'].push({
          id: items.id.split('/').pop(),
          title: items.name,
          quantity: items.quantity,
          price: items.variant.price,
          variant_id: items.variant.id.split('/').pop(),
          options: items.variant.selectedOptions,
        });
      }
    }
    for (let k = 0; k < orderById.line_items.length; k++) {
      if (lineItems[orderById.line_items[k].product_id] !== undefined) {
        lineItems[orderById.line_items[k].product_id]['properties'] =
          orderById.line_items[k].properties;
      }
    }
    return lineItems;
  } else {
    return [];
  }
}

// get draft orders by id
const getDraftOrderById = async function (req, res) {
  const logger = loggerTrack('draftOrder/getDraftOrderById');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`Missing required parameter order id`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'order id is required',
      },
    });
  } else {
    let result = {};
    let orderId = req.params.id;
    let artIds = [];
    const draftOrderDetails = await getShopifyDraftOrderByIdViaGraphQl(orderId);
    if (draftOrderDetails && draftOrderDetails !== null) {
      const draftOrder = draftOrderDetails.draftOrders.edges;
      const order = draftOrder[0].node;
      const orderId = order.id.split('/').pop();
      const orderLineItems = order.lineItems.edges;
      let customerData = {};
      if (order.customer !== null) {
        customerData['id'] = order.customer.id.split('/').pop();
        customerData['name'] = order.customer.displayName;
        customerData['email'] = order.customer.email;
        customerData['address'] = order.customer.defaultAddress;
        customerData['sales_rep_id'] = null;
        if (order.customer.tags) {
          const customerTagArray = order.customer.tags;
          customerTagArray.forEach((custTag) => {
            if (custTag.includes('salesRep')) {
              let saleRepId = custTag.split(':').pop();
              customerData['sales_rep_id'] = saleRepId;
            }
          });
        }
      }
      if (Object.keys(customerData).length == 0) {
        customerData = null;
      }
      const lineItems = await getLineItems(orderId, orderLineItems);
      const customizedProductdetails =
        await draftOrderModel.getCustomizedProductsByOrder(orderId);
      let customizedProducts = {};
      for (let i = 0; i < customizedProductdetails.length; i++) {
        customizedProducts[customizedProductdetails[i].sh_product_id] =
          customizedProductdetails[i];
      }
      const tagArray = order.tags;
      let requiredBy = '';
      tagArray.forEach((tag) => {
        if (tag.includes('artworkID')) {
          let artId = tag.split(':').pop();
          artIds.push(artId);
        }
        if (tag.includes('requiredBy')) {
          requiredBy = tag.split(':').pop();
        }
      });
      result = {
        id: orderId,
        name: order.name,
        email: order.email,
        line_items: lineItems,
        customer: customerData,
        metafield: order.metafield,
        customized_products: customizedProducts,
        required_by: requiredBy,
        instruction: order.note2,
        billingAddress: order.billingAddress,
        shippingAddress: order.shippingAddress,
        subtotalPrice: order.subtotalPrice,
        totalShippingPrice: order.totalShippingPrice,
        totalTax: order.totalTax,
        totalPrice: order.totalPrice,
        invoiceUrl: order.invoiceUrl,
        createdAt: order.createdAt,
      };
      // get artwork names from database
      if (artIds !== undefined || artIds.length > 0) {
        artIds = artIds.join("','");
        artWorkModel.getArtworksByIds(artIds, (err, arts) => {
          if (arts != null) {
            let artwork = {};
            for (let k = 0; k < arts.length; k++) {
              artwork[arts[k].id] = arts[k].artwork_name;
            }
            return res.status(200).json({
              message: 'success',
              body: {
                purchase_order: result,
                artwork: artwork,
              },
            });
          } else {
            return res.status(200).json({
              message: 'success',
              body: {
                purchase_order: result,
                artwork: {},
              },
            });
          }
        });
      } else {
        return res.status(200).json({
          message: 'success',
          body: {
            purchase_order: result,
            artwork: {},
          },
        });
      }
    } else {
      logger.debug(`Failed to get the order details`);
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to get the order details',
        },
      });
    }
  }
};

// get draft orders by id
const getDraftOrderPreviewsById = async function (req, res) {
  const logger = loggerTrack('draftOrder/getDraftOrderPreviewsById');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`Missing required parameter order id`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'order id is required',
      },
    });
  } else {
    let result = {};
    let orderId = req.params.id;
    let artIds = [];
    const draftOrderDetails = await getShopifyDraftOrderByIdViaGraphQl(orderId);
    if (draftOrderDetails && draftOrderDetails !== null) {
      const draftOrder = draftOrderDetails.draftOrders.edges;
      const order = draftOrder[0].node;
      const orderId = order.id.split('/').pop();
      const orderLineItems = order.lineItems.edges;
      let customerData = {};
      if (order.customer !== null) {
        customerData['id'] = order.customer.id.split('/').pop();
        customerData['name'] = order.customer.displayName;
        customerData['email'] = order.customer.email;
        customerData['address'] = order.customer.defaultAddress;
        customerData['sales_rep_id'] = null;
        if (order.customer.tags) {
          const customerTagArray = order.customer.tags;
          customerTagArray.forEach((custTag) => {
            if (custTag.includes('salesRep')) {
              const saleRepId = custTag.split(':').pop();
              customerData['sales_rep_id'] = saleRepId;
            }
          });
        }
      }
      if (Object.keys(customerData).length == 0) {
        customerData = null;
      }
      const lineItems = await getLineItems(orderId, orderLineItems);
      const customizedProductdetails =
        await draftOrderModel.getCustomizedProductsByOrder(orderId);
      let customizedProducts = {};
      let productArtwork = {};
      let productById = [];
      let productNames = {};
      for (let i = 0; i < customizedProductdetails.length; i++) {
        customizedProducts[customizedProductdetails[i].sh_product_id] =
          customizedProductdetails[i];
        let metaValues = JSON.parse(order.metafield.value);
        let artworkDetails = {};
        let productMetaValues =
          metaValues[customizedProductdetails[i].sh_product_id]
            .customization_elements;
        Object.keys(productMetaValues).forEach(function (key, index) {
          delete productMetaValues[key].product_image;
          delete productMetaValues[key].art_image_status;
          Object.keys(productMetaValues[key].art_image_array).forEach(function (
            keys,
            index,
          ) {
            let artName = productMetaValues[key].art_image_array[keys].name;
            artworkDetails[artName] =
              productMetaValues[key].art_image_array[keys].image_url;
          });
        });
        productMetaValues.artworks = artworkDetails;
        let proID = customizedProductdetails[i].sh_product_id;
        productArtwork[proID] = productMetaValues;
        let productDetailsById =
          await ShopifyProductRest.getShopifyProductByProductId(
            customizedProductdetails[i].sh_product_id,
          );
        productById.push(productDetailsById.images);
        productNames[proID] =
          lineItems[customizedProductdetails[i].sh_product_id].product_name;
      }
      const tagArray = order.tags;
      let requiredBy = '';
      let createdBy = '';
      let createdCustomer = 'admin';
      tagArray.forEach((tag) => {
        if (tag.includes('artworkID')) {
          const artId = tag.split(':').pop();
          artIds.push(artId);
        }
        if (tag.includes('requiredBy')) {
          requiredBy = tag.split(':').pop();
        }
        if (tag.includes('createdBy')) {
          createdBy = tag.split(':').pop();
        }
      });
      if (createdBy && createdBy != constants.roles.admin) {
        createdCustomer = await ShopifyCustomerRest.getShopifyCustomerById(
          createdBy,
        );
      }
      result = {
        id: orderId,
        name: order.name,
        email: order.email,
        customer: customerData,
        customized_products: customizedProducts,
        required_by: requiredBy,
        productArtwork: productArtwork,
        createdCustomer: createdCustomer,
        productById: productById,
        productNames: productNames,
      };
      // get artwork names from database
      if (artIds !== undefined || artIds.length > 0) {
        artIds = artIds.join("','");
        artWorkModel.getArtworksByIds(artIds, (err, arts) => {
          if (arts != null) {
            let artwork = {};
            for (let k = 0; k < arts.length; k++) {
              artwork[arts[k].id] = [arts[k].artwork_name, arts[k].artwork_url];
            }
            return res.status(200).json({
              message: 'success',
              body: {
                purchase_order: result,
                artwork: artwork,
              },
            });
          } else {
            return res.status(200).json({
              message: 'success',
              body: {
                purchase_order: result,
                artwork: {},
              },
            });
          }
        });
      } else {
        return res.status(200).json({
          message: 'success',
          body: {
            purchase_order: result,
            artwork: {},
          },
        });
      }
    } else {
      logger.debug(`Failed to get the order details`);
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to get the order details',
        },
      });
    }
  }
};

// get draft orders by customer id
const getDraftOrdersByCustomerId = async function (req, res) {
  const logger = loggerTrack('draftOrder/getDraftOrdersByCustomerId');
  logger.info('------------start--------------');
  let pageType = 'next';
  let cursor = null;
  let queryString = null;
  if (
    Object.keys(req.query).length === 0 ||
    req.query['customer-id'] === undefined
  ) {
    logger.debug(`Missing required parameter customer id`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  } else {
    const customerId = req.query['customer-id'];
    const loggedCustomerId = req.user.id;
    const loggedCustomerRole = req.user.role;
    if (req.query.previous !== undefined) {
      pageType = 'previous';
      cursor = req.query.previous;
    }
    if (req.query.next !== undefined) {
      pageType = 'next';
      cursor = req.query.next;
    }
    if (req.query.query !== undefined) {
      queryString = req.query.query;
    }
    let previousCursor = null;
    let nextCursor = null;
    let result = [];
    const draftOrderDetails = await getDraftOrdersFromShopify(
      cursor,
      pageType,
      null,
      null,
      customerId,
      loggedCustomerId,
      loggedCustomerRole,
    );
    if (draftOrderDetails && draftOrderDetails.draftOrders !== undefined) {
      const pageInfo = draftOrderDetails.draftOrders.pageInfo;
      const draftOrders = draftOrderDetails.draftOrders.edges;
      if (draftOrders) {
        for (let i = 0; i < draftOrders.length; i++) {
          if (i == 0 && pageInfo.hasPreviousPage === true) {
            previousCursor = draftOrders[i].cursor;
          } else if (
            i + 1 == draftOrders.length &&
            pageInfo.hasNextPage === true
          ) {
            nextCursor = draftOrders[i].cursor;
          }
          const order = draftOrders[i].node;
          const orderId = order.id.split('/').pop();
          const orderLineItems = order.lineItems.edges;
          let customerData = {};
          if (order.customer !== null) {
            customerData['id'] = order.customer.id.split('/').pop();
            customerData['name'] = order.customer.displayName;
            customerData['email'] = order.customer.email;
          }
          if (Object.keys(customerData).length == 0) {
            customerData = null;
          }
          const lineItems = await getLineItems(orderId, orderLineItems);
          result[i] = {
            id: orderId,
            name: order.name,
            email: order.email,
            line_items: lineItems,
            total_price: order.totalPrice,
            customer: customerData,
          };
        }
        return res.status(200).json({
          message: 'success',
          body: {
            purchase_orders: result,
            next_cursor: nextCursor,
            previous_cursor: previousCursor,
          },
        });
      } else {
        return res.status(200).json({
          message: 'success',
          body: {
            purchase_orders: [],
            next_cursor: nextCursor,
            previous_cursor: previousCursor,
          },
        });
      }
    } else {
      logger.debug(`Failed to get the order details`);
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to get the order details',
        },
      });
    }
  }
};

// create draft order
const createDraftOrder = async function (req, res) {
  const logger = loggerTrack('draftOrder/createDraftOrder');
  logger.info('------------start--------------');
  if (req.body && req.files) {
    let customerId = req.body.customer_id;
    let customProduct = JSON.parse(req.body.custom_product);
    let tags = '';
    const userRole = req.user.role;
    if (userRole == constants.roles.admin) {
      tags = `createdBy:${userRole}`;
      tags += `,orderFor:customer:${customerId}`;
    } else {
      const userId = req.user.id;
      tags = `createdBy:${userRole}:${userId}`;
      tags += `,orderFor:customer:${customerId}`;
    }
    let products = [];
    let productVariants = [];
    let lineItems = [];
    let customization = {};
    let index = 0;
    let key = 0;
    for (let productId of Object.keys(customProduct)) {
      products[index] = productId;
      productVariants[productId] = [];
      customization[productId] = JSON.parse(
        customProduct[productId].customization_info,
      ).customization_elements;
      let productLines = customProduct[productId].lineItems;
      for (let i = 0; i < productLines.length; i++) {
        productLines[i]['productId'] = productId;
        lineItems[key] = productLines[i];
        productVariants[productId][i] = productLines[i].variantId;
        key++;
      }
      index++;
    }
    let requestData = [];
    if (req.files) {
      let customImage = '';
      let properites = {};
      let customProductImages = {};
      let response = '';
      for (const side of Object.keys(req.files)) {
        const file = side.split('-');
        const productSide = file[0];
        let productId = file[1];
        if (
          customization[productId][productSide] !== undefined &&
          Object.keys(customization[productId][productSide].art_image_array)
            .length > 0
        ) {
          const imageFile = req.files[side];
          const filename = req.files[side]['name'];
          const imageData = {
            imageFile: imageFile,
            filename: filename,
            subFolder: 'customized-product',
            customerID: customerId,
          };
          const { status, fileName, message } = fileUpload(imageData);
          if (status) {
            customImage =
              'https://' +
              req.headers.host +
              '/images/customized-product/' +
              fileName;
            if (!(productId in customProductImages)) {
              customProductImages[productId] = [];
            }
            customProductImages[productId][productSide] = customImage;
            if (!(productId in properites)) {
              properites[productId] = [
                {
                  name: 'Custom Product Rendering - ' + ucfirst(productSide),
                  value: customImage,
                },
              ];
            } else {
              properites[productId].push({
                name: 'Custom Product Rendering - ' + ucfirst(productSide),
                value: customImage,
              });
            }
          } else {
            if (!(productId in properites)) {
              properites[productId] = [
                {
                  name: 'Custom Product Rendering - ' + ucfirst(productSide),
                  value: '[no customization]',
                },
              ];
            }
            properites[productId].push({
              name: 'Custom Product Rendering - ' + ucfirst(productSide),
              value: '[no customization]',
            });
          }
        } else {
          if (!(productId in properites)) {
            properites[productId] = [
              {
                name: 'Custom Product Rendering - ' + ucfirst(productSide),
                value: '[no customization]',
              },
            ];
          }
          properites[productId].push({
            name: 'Custom Product Rendering - ' + ucfirst(productSide),
            value: '[no customization]',
          });
        }
      }
      let orderLineItems = [];
      let variantIds = [];
      for (let i = 0; i < lineItems.length; i++) {
        orderLineItems[i] = {
          product_id: lineItems[i].productId,
          variant_id: lineItems[i].variantId,
          quantity: lineItems[i].quantity,
        };
        variantIds[i] = lineItems[i].variantId;
        if (userRole == constants.roles.customer) {
          tags += ',' + lineItems[i].productId + ':' + 'pendingAdminApproval';
        } else {
          tags +=
            ',' + lineItems[i].productId + ':' + 'pendingCustomerApproval';
        }
      }
      const customProductRenderingData = {
        shCutomerId: customerId,
        customProducts: customProductImages,
        productIds: products,
        variants: productVariants,
      };
      draftOrderModel.insertCustomProduct(
        customProductRenderingData,
        async (err, result) => {
          if (err) {
            logger.debug(
              `Failed to create the draft order :- ${JSON.stringify(err)}`,
            );
            return res.status(600).json({
              message: 'error',
              body: {
                error: 'Failed to create the draft order',
              },
            });
          } else if (result) {
            let customProductIds = result;
            let artIds = [];
            let n = 0;
            let productArts = {};
            for (let productId of Object.keys(customization)) {
              productArts[productId] = [];
              const customInfo = customization[productId];
              for (const artElemet of Object.keys(customInfo)) {
                if (customInfo[artElemet].art_image_status) {
                  const arts = customInfo[artElemet].art_image_array;
                  for (const artwork of Object.keys(arts)) {
                    artIds[n] = arts[artwork].id;
                    if (!(productId in productArts)) {
                      productArts[productId] = [];
                    }
                    productArts[productId].push(parseInt(arts[artwork].id));
                    n++;
                  }
                }
              }
            }
            if (artIds !== undefined || artIds.length > 0) {
              artIds = artIds.join("','");
              artWorkModel.getArtworksByIds(artIds, async (err, result) => {
                if (err) {
                  logger.debug(
                    `Failed to create the draft order :- ${JSON.stringify(
                      err,
                    )}`,
                  );
                  return res.status(600).json({
                    message: 'error',
                    body: {
                      error: 'Failed to create the draft order',
                    },
                  });
                } else if (result != '') {
                  let artworkArray = {};
                  for (let j = 0; j < result.length; j++) {
                    for (let productId of Object.keys(productArts)) {
                      if (productArts[productId].includes(result[j].id)) {
                        properites[productId].push({
                          name: 'Artwork-' + result[j].id,
                          value: result[j].artwork_url,
                        });
                        tags += ', artworkID:' + result[j].id;
                        artworkArray[result[j].id] = result[j].artwork_url;
                        if (customProductIds[productId] !== undefined) {
                          if (!('arts' in customProductIds[productId])) {
                            customProductIds[productId]['arts'] = [];
                          }
                          customProductIds[productId]['arts'].push(
                            result[j].id,
                          );
                        }
                      }
                    }
                  }
                  for (let i = 0; i < orderLineItems.length; i++) {
                    const productId = orderLineItems[i].product_id;
                    if (properites[productId] !== undefined) {
                      orderLineItems[i]['properties'] = properites[productId];
                    }
                  }
                  const imageAssociationData = {
                    associationData: customProductIds,
                  };
                  draftOrderModel.insertImageAssociation(
                    imageAssociationData,
                    async (err, result) => {
                      if (err) {
                        logger.debug(
                          `Failed to create the draft order :- ${JSON.stringify(
                            err,
                          )}`,
                        );
                        return res.status(600).json({
                          message: 'error',
                          body: {
                            error: 'Failed to create the draft order',
                          },
                        });
                      } else if (result != '') {
                        // update the artwork preview image in the customization info to artwork url in the db
                        for (let productId of Object.keys(customization)) {
                          productArts[productId] = [];
                          let customInfo = customization[productId];
                          for (const artElemet of Object.keys(customInfo)) {
                            if (customInfo[artElemet].art_image_status) {
                              const arts =
                                customInfo[artElemet].art_image_array;
                              if (
                                Object.keys(
                                  customInfo[artElemet].art_image_array,
                                ).length > 0
                              ) {
                                for (const artwork of Object.keys(arts)) {
                                  artIds[n] = arts[artwork].id;
                                  n++;
                                }
                              } else {
                                delete customInfo[artElemet];
                              }
                            }
                          }
                          const customization_elements = customInfo;
                          let customData = {};
                          customData[productId] = JSON.parse(
                            customProduct[productId].customization_info,
                          );
                          customData[productId].customization_elements =
                            customization_elements;
                          customProduct[productId] = customData[productId];
                        }
                        const metafields = [
                          {
                            key: 'customization_details',
                            value: JSON.stringify(customProduct),
                            value_type: 'string',
                            namespace: 'global',
                          },
                        ];
                        requestData = {
                          line_items: orderLineItems,
                          tags: tags,
                          customer: {
                            id: customerId,
                          },
                          metafields: metafields,
                        };
                        try {
                          response =
                            await ShopifyDraftOrderRest.createShopifyDraftOrder(
                              requestData,
                            );
                        } catch (e) {
                          logger.debug(
                            `Failed to create the draft order :- ${JSON.stringify(
                              e,
                            )}`,
                          );
                          return res.status(600).json({
                            message: 'error',
                            body: {
                              error: 'Failed to create the draft order',
                            },
                          });
                        }
                        if (response) {
                          const data = {
                            shOrderId: response.id,
                            customProductIds: customProductIds,
                          };
                          draftOrderModel.insertOrder(
                            data,
                            async (err, result) => {
                              if (err) {
                                logger.debug(
                                  `Failed to create the draft order :- ${JSON.stringify(
                                    err,
                                  )}`,
                                );
                                return res.status(600).json({
                                  message: 'error',
                                  body: {
                                    error: 'Failed to create the draft order',
                                  },
                                });
                              } else if (result != '') {
                                try {
                                  await sendEmailNotificationForDraftOrderCreation(
                                    response,
                                  );
                                } catch (e) {
                                  logger.debug(
                                    `Failed to create klaviyo event: ${e}`,
                                  );
                                }
                                result = {
                                  message: 'success',
                                  body: {
                                    created: true,
                                    order_id: response.id,
                                    message:
                                      'Draft order created successfully in shopify',
                                  },
                                };
                                logger.info(
                                  `Draft order created successfully in shopify :- ${JSON.stringify(
                                    err,
                                  )}`,
                                );
                                logger.info('------------end--------------');
                                return res.status(200).json({
                                  message: 'success',
                                  body: {
                                    created: true,
                                    order_id: response.id,
                                    order_name: response.name,
                                    message:
                                      'Draft order created successfully in shopify',
                                  },
                                });
                              }
                            },
                          );
                        }
                      }
                    },
                  );
                }
              });
            } else {
              const metafields = [];
              metafields = [
                {
                  key: 'customization_details',
                  value: JSON.stringify(customProduct),
                  value_type: 'string',
                  namespace: 'global',
                },
              ];
              requestData = {
                line_items: orderLineItems,
                tags: tags,
                customer: {
                  id: customerId,
                },
                metafields: metafields,
              };
              try {
                response = await ShopifyDraftOrderRest.createShopifyDraftOrder(
                  requestData,
                );
              } catch (e) {
                logger.debug(
                  `Failed to create the draft order :- ${JSON.stringify(e)}`,
                );
                return res.status(600).json({
                  message: 'error',
                  body: {
                    error: 'Failed to create the draft order',
                  },
                });
              }
              if (response) {
                const data = {
                  shOrderId: response.id,
                  customProductIds: customProductIds,
                };
                draftOrderModel.insertOrder(data, async (err, result) => {
                  if (err) {
                    logger.debug(
                      `Failed to create the draft order :- ${JSON.stringify(
                        e,
                      )}`,
                    );
                    return res.status(600).json({
                      message: 'error',
                      body: {
                        error: 'Failed to create the draft order',
                      },
                    });
                  } else if (result != '') {
                    try {
                      await sendEmailNotificationForDraftOrderCreation(
                        response,
                      );
                    } catch (e) {
                      logger.debug(`Failed to create klaviyo event: ${e}`);
                    }
                    result = {
                      message: 'success',
                      body: {
                        created: true,
                        order_id: response.id,
                        message: 'Draft order created successfully in shopify',
                      },
                    };
                    logger.info(
                      `Draft order created successfully in shopify :- ${JSON.stringify(
                        e,
                      )}`,
                    );
                    logger.info('------------end--------------');
                    return res.status(200).json({
                      message: 'success',
                      body: {
                        created: true,
                        order_id: response.id,
                        order_name: response.name,
                        message: 'Draft order created successfully in shopify',
                      },
                    });
                  }
                });
              }
            }
          } else {
            logger.debug(`Failed to create the draft order`);
            return res.status(600).json({
              message: 'error',
              body: {
                error: 'Failed to create the draft order',
              },
            });
          }
        },
      );
    }
  }
};

// update draft order
const updateDraftOrder = async function (req, res) {
  const logger = loggerTrack('draftOrder/updateDraftOrder');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`order id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'order id is required',
      },
      art_image_array,
    });
  } else {
    const orderId = req.params.id;
    let orderTags = '';
    if (req.body && (req.files || req.body.files)) {
      const orderDetails = await ShopifyDraftOrderRest.getShopifyDraftOrderById(
        orderId,
      );
      orderTags = orderDetails.tags;
      const customerId = req.body.customer_id;
      let customProduct = JSON.parse(req.body.custom_product);
      let products = [];
      let productVariants = [];
      let lineItems = [];
      let customization = {};
      let index = 0;
      let key = 0;
      for (let productId of Object.keys(customProduct)) {
        products[index] = productId;
        productVariants[productId] = [];
        customization[productId] = JSON.parse(
          customProduct[productId].customization_info,
        ).customization_elements;
        let productLines = customProduct[productId].lineItems;
        for (let keys in productLines) {
          productLines[keys]['productId'] = productId;
          lineItems[key] = productLines[keys];
          productVariants[productId][keys] = parseInt(
            productLines[keys].variantId,
          );
          key++;
        }
        index++;
      }
      let requestData = [];
      if (req.files || req.body.files) {
        let customImage = '';
        let tags = '';
        let properites = {};
        let customProductImages = {};
        let response = '';
        if (req.files) {
          for (const side of Object.keys(req.files)) {
            const file = side.split('-');
            let productSide = file[0];
            let productId = file[1];
            if (
              customization[productId][productSide] !== undefined &&
              Object.keys(customization[productId][productSide].art_image_array)
                .length > 0
            ) {
              let imageFile = req.files[side];
              let filename = req.files[side]['name'];
              let imageData = {
                imageFile: imageFile,
                filename: filename,
                subFolder: 'customized-product',
                customerID: customerId,
              };
              const { status, fileName, message } = fileUpload(imageData);
              if (status) {
                customImage =
                  'https://' +
                  req.headers.host +
                  '/images/customized-product/' +
                  fileName;
                if (!(productId in customProductImages)) {
                  customProductImages[productId] = [];
                }
                customProductImages[productId][productSide] = customImage;
                if (!(productId in properites)) {
                  properites[productId] = [
                    {
                      name:
                        'Custom Product Rendering - ' + ucfirst(productSide),
                      value: customImage,
                    },
                  ];
                } else {
                  properites[productId].push({
                    name: 'Custom Product Rendering - ' + ucfirst(productSide),
                    value: customImage,
                  });
                }
              } else {
                if (!(productId in properites)) {
                  properites[productId] = [
                    {
                      name:
                        'Custom Product Rendering - ' + ucfirst(productSide),
                      value: '[no customization]',
                    },
                  ];
                }
                properites[productId].push({
                  name: 'Custom Product Rendering - ' + ucfirst(productSide),
                  value: '[no customization]',
                });
              }
            } else {
              if (!(productId in properites)) {
                properites[productId] = [
                  {
                    name: 'Custom Product Rendering - ' + ucfirst(productSide),
                    value: '[no customization]',
                  },
                ];
              }
              properites[productId].push({
                name: 'Custom Product Rendering - ' + ucfirst(productSide),
                value: '[no customization]',
              });
            }
          }
        } else {
          let files = JSON.parse(req.body.files);
          for (const side of Object.keys(files)) {
            const file = side.split('-');
            let productSide = file[0];
            let productId = file[1];
            if (
              customization[productId][productSide] !== undefined &&
              Object.keys(customization[productId][productSide].art_image_array)
                .length > 0
            ) {
              customImage = files[side];
              if (customImage != null) {
                if (!(productId in customProductImages)) {
                  customProductImages[productId] = [];
                }
                customProductImages[productId][productSide] = customImage;
                if (!(productId in properites)) {
                  properites[productId] = [
                    {
                      name:
                        'Custom Product Rendering - ' + ucfirst(productSide),
                      value: customImage,
                    },
                  ];
                } else {
                  properites[productId].push({
                    name: 'Custom Product Rendering - ' + ucfirst(productSide),
                    value: customImage,
                  });
                }
              } else {
                if (!(productId in properites)) {
                  properites[productId] = [
                    {
                      name:
                        'Custom Product Rendering - ' + ucfirst(productSide),
                      value: '[no customization]',
                    },
                  ];
                }
                properites[productId].push({
                  name: 'Custom Product Rendering - ' + ucfirst(productSide),
                  value: '[no customization]',
                });
              }
            } else {
              if (!(productId in properites)) {
                properites[productId] = [
                  {
                    name: 'Custom Product Rendering - ' + ucfirst(productSide),
                    value: '[no customization]',
                  },
                ];
              }
              properites[productId].push({
                name: 'Custom Product Rendering - ' + ucfirst(productSide),
                value: '[no customization]',
              });
            }
          }
        }
        let metafields = await ShopifyDraftOrderRest.getDraftOrderMetafields(
          orderId,
        );
        let metafieldId = '';
        for (let metafield of metafields) {
          if (metafield.key == 'customization_details') {
            metafieldId = metafield.id;
            break;
          }
          continue;
        }
        let orderLineItems = [];
        let variantIds = [];
        for (let i = 0; i < lineItems.length; i++) {
          orderLineItems[i] = {
            product_id: lineItems[i].productId,
            variant_id: lineItems[i].variantId,
            quantity: lineItems[i].quantity,
          };
          variantIds[i] = lineItems[i].variantId;
        }
        const customProductRenderingData = {
          shCutomerId: customerId,
          customProducts: customProductImages,
          productIds: products,
          variants: productVariants,
        };
        draftOrderModel.insertCustomProduct(
          customProductRenderingData,
          async (err, result) => {
            if (err) {
              logger.debug(
                `Failed to update the draft order :- ${JSON.stringify(err)}`,
              );
              return res.status(600).json({
                message: 'error',
                body: {
                  error: 'Failed to update the draft order',
                },
              });
            } else if (result) {
              let customProductIds = result;
              let artIds = [];
              let n = 0;
              let productArts = {};
              for (let productId of Object.keys(customization)) {
                productArts[productId] = [];
                let customInfo = customization[productId];
                for (let artElemet of Object.keys(customInfo)) {
                  if (customInfo[artElemet].art_image_status) {
                    let arts = customInfo[artElemet].art_image_array;
                    for (let artwork of Object.keys(arts)) {
                      artIds[n] = arts[artwork].id;
                      if (!(productId in productArts)) {
                        productArts[productId] = [];
                      }
                      productArts[productId].push(parseInt(arts[artwork].id));
                      n++;
                    }
                  }
                }
              }
              if (artIds !== undefined || artIds.length > 0) {
                artIds = artIds.join("','");
                artWorkModel.getArtworksByIds(artIds, async (err, result) => {
                  if (err) {
                    logger.debug(
                      `Failed to update the draft order :- ${JSON.stringify(
                        err,
                      )}`,
                    );
                    return res.status(600).json({
                      message: 'error',
                      body: {
                        error: 'Failed to update the draft order',
                      },
                    });
                  } else if (result != '') {
                    let artworkArray = {};
                    for (let j = 0; j < result.length; j++) {
                      for (let productId of Object.keys(productArts)) {
                        if (productArts[productId].includes(result[j].id)) {
                          properites[productId].push({
                            name: 'Artwork-' + result[j].id,
                            value: result[j].artwork_url,
                          });
                          tags += ', artworkID:' + result[j].id;
                          artworkArray[result[j].id] = result[j].artwork_url;
                          if (customProductIds[productId] !== undefined) {
                            if (!('arts' in customProductIds[productId])) {
                              customProductIds[productId]['arts'] = [];
                            }
                            customProductIds[productId]['arts'].push(
                              result[j].id,
                            );
                          }
                        }
                      }
                    }
                    for (let i = 0; i < orderLineItems.length; i++) {
                      let productId = orderLineItems[i].product_id;
                      if (properites[productId] !== undefined) {
                        orderLineItems[i]['properties'] = properites[productId];
                      }
                    }
                    const imageAssociationData = {
                      associationData: customProductIds,
                    };
                    draftOrderModel.insertImageAssociation(
                      imageAssociationData,
                      async (err, result) => {
                        if (err) {
                          logger.debug(
                            `Failed to update the draft order :- ${JSON.stringify(
                              err,
                            )}`,
                          );
                          return res.status(600).json({
                            message: 'error',
                            body: {
                              error: 'Failed to update the draft order',
                            },
                          });
                        } else if (result != '') {
                          // update the artwork preview image in the customization info to artwork url in the db
                          for (let productId of Object.keys(customization)) {
                            productArts[productId] = [];
                            let customInfo = customization[productId];
                            for (let artElemet of Object.keys(customInfo)) {
                              if (customInfo[artElemet].art_image_status) {
                                if (
                                  Object.keys(
                                    customInfo[artElemet].art_image_array,
                                  ).length > 0
                                ) {
                                  let arts =
                                    customInfo[artElemet].art_image_array;
                                  for (let artwork of Object.keys(arts)) {
                                    artIds[n] = arts[artwork].id;
                                    n++;
                                  }
                                } else {
                                  delete customInfo[artElemet];
                                }
                              }
                            }
                            let customization_elements = customInfo;
                            let customData = {};
                            customData[productId] = JSON.parse(
                              customProduct[productId].customization_info,
                            );
                            customData[productId].customization_elements =
                              customization_elements;
                            customProduct[productId] = customData[productId];
                          }
                          let metafields = {
                            value: JSON.stringify(customProduct),
                          };
                          requestData = {
                            line_items: orderLineItems,
                            tags: orderTags + ',' + tags,
                            customer_id: customerId,
                          };
                          try {
                            response =
                              await ShopifyDraftOrderRest.updateShopifyDraftOrder(
                                orderId,
                                requestData,
                              );
                          } catch (e) {
                            logger.debug(
                              `Failed to update the draft order :- ${JSON.stringify(
                                e,
                              )}`,
                            );
                            return res.status(600).json({
                              message: 'error',
                              body: {
                                error: 'Failed to update the draft order',
                              },
                            });
                          }
                          if (response) {
                            if (metafieldId != '') {
                              await ShopifyDraftOrderRest.updateMetafield(
                                metafieldId,
                                metafields,
                              );
                            }
                            const data = {
                              shOrderId: orderId,
                              customProductIds: customProductIds,
                            };
                            draftOrderModel.updateOrder(
                              data,
                              async (err, result) => {
                                if (err) {
                                  logger.debug(
                                    `Failed to update the draft order :- ${JSON.stringify(
                                      err,
                                    )}`,
                                  );
                                  return res.status(600).json({
                                    message: 'error',
                                    body: {
                                      error: 'Failed to update the draft order',
                                    },
                                  });
                                } else if (result != '') {
                                  try {
                                    const userRole = req.user.role;
                                    await sendEmailNotificationForUpdateDraftOrderCreation(
                                      response,
                                      userRole,
                                    );
                                  } catch (e) {
                                    logger.debug(
                                      `Failed to create klaviyo event: ${e}`,
                                    );
                                  }
                                  result = {
                                    message: 'success',
                                    body: {
                                      created: true,
                                      order_id: response.id,
                                      message:
                                        'Draft order updated successfully in shopify',
                                    },
                                  };
                                  logger.info(
                                    `Draft order updated successfully in shopify`,
                                  );
                                  logger.info('------------end--------------');
                                  return res.status(200).json({
                                    message: 'success',
                                    body: {
                                      created: true,
                                      order_id: response.id,
                                      order_name: response.name,
                                      message:
                                        'Draft order updated successfully in shopify',
                                    },
                                  });
                                }
                              },
                            );
                          }
                        }
                      },
                    );
                  }
                });
              } else {
                requestData = {
                  line_items: orderLineItems,
                  customer: {
                    id: customerId,
                  },
                };
                try {
                  response =
                    await ShopifyDraftOrderRest.updateShopifyDraftOrder(
                      orderId,
                      requestData,
                    );
                } catch (e) {
                  logger.debug(
                    `Failed to update the draft order :- ${JSON.stringify(e)}`,
                  );
                  return res.status(600).json({
                    message: 'error',
                    body: {
                      error: 'Failed to update the draft order',
                    },
                  });
                }
                if (response) {
                  let metafields = {
                    value: JSON.stringify(customProduct),
                  };
                  if (metafieldId != '') {
                    await ShopifyDraftOrderRest.updateMetafield(
                      metafieldId,
                      metafields,
                    );
                  }
                  const data = {
                    shOrderId: response.id,
                    customProductIds: customProductIds,
                  };
                  draftOrderModel.insertOrder(data, async (err, result) => {
                    if (err) {
                      logger.debug(
                        `Failed to update the draft order :- ${JSON.stringify(
                          err,
                        )}`,
                      );
                      return res.status(600).json({
                        message: 'error',
                        body: {
                          error: 'Failed to update the draft order',
                        },
                      });
                    } else if (result != '') {
                      return res.status(200).json({
                        message: 'success',
                        body: {
                          created: true,
                          order_id: response.id,
                          order_name: response.name,
                          message:
                            'Draft order updated successfully in shopify',
                        },
                      });
                    }
                  });
                }
              }
            } else {
              logger.debug(
                `Failed to update the draft order :- ${JSON.stringify(err)}`,
              );
              return res.status(600).json({
                message: 'error',
                body: {
                  error: 'Failed to update the draft order',
                },
              });
            }
          },
        );
      }
    }
  }
};

// add instructions to the draft order
const addOrderInstructions = async function (req, res) {
  const logger = loggerTrack('draftOrder/orderInstructions');
  logger.info('------------start--------------');
  if (req.body) {
    logger.info(JSON.stringify(req.body));
    const orderId = req.body.order_id;
    let orderDetails = [];
    let response = '';
    try {
      orderDetails = await ShopifyDraftOrderRest.getShopifyDraftOrderById(
        orderId,
      );
    } catch (e) {
      logger.info(`Invalid order id - ${orderId}`);
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Invalid order id',
        },
      });
    }
    if (orderDetails != '') {
      let tags = orderDetails.tags;
      let requiredBy = req.body.required_by;
      if (requiredBy) {
        requiredBy = moment(requiredBy).format('MM/DD/YYYY');
        requiredBy = `requiredBy:${requiredBy}`;
      }
      if (tags.includes('requiredBy:')) {
        let tagArray = tags.split(',');
        for (let i = 0; i < tagArray.length; i++) {
          if (tagArray[i].includes('requiredBy:')) {
            tagArray.splice(i, 1);
            i--;
          }
        }
        tags = tagArray.join(',');
      }
      let updateRequest = {
        tags: tags + ', ' + requiredBy,
        note: req.body.instructions,
      };
      logger.info(`Request : ${JSON.stringify(updateRequest)}`);
      try {
        response = await ShopifyDraftOrderRest.updateShopifyDraftOrder(
          orderId,
          updateRequest,
        );
      } catch (e) {
        logger.info('Failed to add the instructions to order');
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to add the instructions to order',
          },
        });
      }
      if (response) {
        logger.info('Draft order insructions added successfully');
        logger.info('-------------end-------------');
        return res.status(200).json({
          message: 'success',
          body: {
            created: true,
            order_id: response.id,
            message: 'Draft order insructions added successfully',
          },
        });
      } else {
        logger.info('Failed to add the instructions to order');
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to add the instructions to order',
          },
        });
      }
    }
  }
};

// approve draft order
const approveDraftOrder = async function (req, res) {
  const logger = loggerTrack('draftOrder/approveOrder');
  logger.info('------------start--------------');
  if (req.body) {
    const userRole = req.user.role;
    logger.info(`Approved by - ${userRole}`);
    logger.info(JSON.stringify(req.body));
    const orderId = req.body.order_id;
    const productId = req.body.product_id;
    let orderDetails = [];
    let response = '';
    try {
      orderDetails = await ShopifyDraftOrderRest.getShopifyDraftOrderById(
        orderId,
      );
    } catch (e) {
      logger.info(`Invalid order id - ${orderId}`);
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Invalid order id',
        },
      });
    }
    if (orderDetails != '') {
      let tags = '';
      if (userRole == constants.roles.admin) {
        tags = orderDetails.tags.replace(
          productId + ':pendingAdminApproval',
          '',
        );
        tags = tags + ',' + productId + ':adminApproved';
      } else if (userRole == constants.roles.customer) {
        tags = orderDetails.tags.replace(
          productId + ':pendingCustomerApproval',
          '',
        );
        tags = tags + ',' + productId + ':customerApproved';
      }
      let updateRequest = {
        tags: tags,
      };
      logger.info(`Request : ${JSON.stringify(updateRequest)}`);
      try {
        response = await ShopifyDraftOrderRest.updateShopifyDraftOrder(
          orderId,
          updateRequest,
        );
      } catch (e) {
        logger.info(`Failed to approve the order by ${userRole}`);
        logger.error(`Error : ${e}`);
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to approve the draft order',
          },
        });
      }
      if (response) {
        try {
          const draftOrder =
            await ShopifyDraftOrderRest.getShopifyDraftOrderById(orderId);
          if (draftOrder && draftOrder !== null) {
            draftOrder['order_id'] = orderId;
            draftOrder['approved_by'] = userRole;
            await sendEmailNotificationForOrderApproval(draftOrder);
          }
        } catch (e) {
          logger.debug(`Failed to create klaviyo event: ${e}`);
        }
        logger.info(`Draft order approved successfully by the ${userRole}`);
        logger.info('-------------end-------------');
        return res.status(200).json({
          message: 'success',
          body: {
            created: true,
            order_id: response.id,
            message: 'Draft order approved successfully',
          },
        });
      } else {
        logger.info(`Failed to approve the order by ${userRole}`);
        logger.info('-------------end-------------');
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to approve the draft order',
          },
        });
      }
    }
  }
};

// add comments to draft order
const addDraftOrderComments = async function (req, res) {
  const logger = loggerTrack('draftOrder/orderComments');
  logger.info('------------start--------------');
  logger.info(`request: ${JSON.stringify(req.body)}`);
  const { errors, isValid } = validate.validateComments(req);
  if (!isValid) {
    logger.debug(errors);
    return res.status(600).json({
      message: 'error',
      body: {
        error: errors,
      },
    });
  }
  draftOrderModel.insertOrderComments(req.body, async (err, result) => {
    if (err) {
      logger.debug(`Failed to add comment: ${err}`);
      logger.info('-------------end-------------');
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to add comment',
        },
      });
    }
    if (result != '') {
      logger.info(`Result: ${JSON.stringify(result)}`);
      let ids = [];
      let usersDetails = null;
      for (let row = 0; row < result.length; row++) {
        if (result[row].sender == null) {
          result[row].sender = constants.rolesadmin;
          result[row].sender_type = constants.roles.admin;
        }
        if (result[row].receiver == null) {
          result[row].receiver = constants.roles.admin;
          result[row].receiver_type = constants.roles.admin;
        }
        if (
          result[row].sender_type != constants.roles.admin &&
          ids.includes(result[row].sender) === false
        ) {
          ids.push(result[row].sender);
        }
        if (
          result[row].receiver_type != constants.roles.admin &&
          ids.includes(result[row].receiver) === false
        ) {
          ids.push(result[row].receiver);
        }
      }
      if (ids != '') {
        try {
          usersDetails = await getMultipleCustomerById(ids);
        } catch (e) {
          logger.debug(`Failed to fetch the user details from Shopify: ${e}`);
        }
      }
      if (usersDetails != '') {
        let users = [];
        for (let i = 0; i < usersDetails.nodes.length; i++) {
          let id = usersDetails.nodes[i].id.split('/').pop();
          users[id] = usersDetails.nodes[i];
        }
        for (let row = 0; row < result.length; row++) {
          if (
            result[row].sender_type != constants.roles.admin &&
            users[result[row].sender] !== undefined
          ) {
            result[row].sender_name = users[result[row].sender].displayName;
            result[row].sender_email = users[result[row].sender].email;
          }
          if (
            result.receiver_type != constants.roles.admin &&
            users[result[row].receiver] !== undefined
          ) {
            result[row].receiver_name = users[result[row].receiver].displayName;
            result[row].receiver_email = users[result[row].receiver].email;
          }
        }
        logger.info(`Notification details: ${JSON.stringify(result)}`);
      }
      try {
        await sendEmailNotificationForComments(result);
      } catch (e) {
        logger.debug(`Failed to create klaviyo event: ${e}`);
      }
      logger.info('Comment added successfully');
      logger.info('-------------end-------------');
      return res.status(200).json({
        message: 'success',
        body: {
          created: true,
          message: 'Comment added successfully',
        },
      });
    }
  });
};

// get draft order comments
const getDraftOrderComments = async function (req, res) {
  const logger = loggerTrack('draftOrder/orderComments');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug('order id is required');
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'order id is required',
      },
    });
  } else {
    let orderId = req.params.id;
    logger.info(`order id : ${orderId}`);
    let data = { orderId: orderId };
    draftOrderModel.getOrderComments(data, (err, result) => {
      if (err) {
        logger.info(
          `Faild to get the draft order comments: ${JSON.stringify(err)}`,
        );
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Faild to get the draft order comments',
          },
        });
      }
      if (result != '') {
        logger.info(
          `Successfully get the draft order comments: ${JSON.stringify(
            result,
          )}`,
        );
        for (let i = 0; i < result.length; i++) {
          if (result[i]['sender'] == null) {
            result[i]['sender'] = constants.roles.admin;
            result[i]['sender_type'] = constants.roles.admin;
          }
          if (result[i]['receiver'] == null) {
            result[i]['receiver'] = constants.roles.admin;
            result[i]['receiver_type'] = constants.roles.admin;
          }
        }
        return res.status(200).json({
          message: 'success',
          body: {
            order_id: orderId,
            comments: result,
          },
        });
      }
    });
  }
};

async function getShopifyDraftOrderByIdViaGraphQl(id) {

  let arguments = `first:1, query:"id:${id}"`;
  try {
    return await graphQlGet(
      shopifyDraftOrderGraphQL.getShopifyDraftOrderById(arguments),
    );
  } catch (e) {
    return null;
  }
}

// get draft orders from shopify
async function getDraftOrdersFromShopify(
  cursor,
  pageType,
  queryString,
  createdBy,
  customerId,
  loggedCustomerId,
  loggedCustomerRole,
) {
  let arguments = 'first:10, reverse:true';
  if (cursor) {
    if (pageType === 'next') {
      arguments += `, after:"${cursor}"`;
    } else if (pageType === 'previous') {
      arguments = `last:10, reverse:true, before:"${cursor}"`;
    }
  }
  arguments += ', query:"status:open';
  if (queryString) {
    if (isFirstCharNum(queryString)) queryString = 'D' + queryString;
    arguments += ` AND ${queryString}`;
  }
  if (customerId && loggedCustomerRole == constants.roles.customer) {
    arguments += ` AND customer_id:${customerId}`;
  }
  if (loggedCustomerRole == constants.roles.salesRep) {
    if (createdBy) {
      arguments += ` AND tag:'createdBy:${createdBy}'`;
    }
  } else if (loggedCustomerRole == constants.roles.customer) {
    if (createdBy) {
      arguments += ` AND tag:'createdBy:${createdBy}'`;
      if (loggedCustomerId) {
        arguments += ` OR tag:'orderFor:customer:${loggedCustomerId}'`;
      }
    }
  } else if (createdBy == constants.roles.admin) {
    if (createdBy) {
      arguments += ` AND tag:'createdBy:${createdBy}'`;
    }
  }
  arguments += '"';

  return await graphQlGet(
    shopifyDraftOrderGraphQL.getAllDraftOrders(arguments),
  );
}

//  get multiple customer based on their ID
async function getMultipleCustomerById(ids) {
  let inputs = '';
  for (let i = 0; i < ids.length; i++) {
    inputs = inputs + `"gid://shopify/Customer/${ids[i]}",`;
  }
  try {
    return await graphQlGet(
      shopifyCustomerGraphQL.getMultipleCustomerById(inputs),
    );
  } catch (e) {
    return null;
  }
}

// send check out checkout url
const sendCheckOutUrlById = async function (req, res) {
  const logger = loggerTrack('draftOrder/sendCheckOutUrlById');
  logger.info('------------start--------------');
  if (Object.keys(req.body).length === 0 || req.body.orderID === undefined) {
    logger.debug(`Missing required parameter order id`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'order id is required',
      },
    });
  } else {
    const orderId = req.body.orderID;
    const draftOrder = await ShopifyDraftOrderRest.getShopifyDraftOrderById(
      orderId,
    );
    if (draftOrder && draftOrder !== null) {
      try {
        await sendEmailNotificationForCheckOutUrl(draftOrder);
      } catch (e) {
        logger.debug(`Failed to create klaviyo event: ${e}`);
      }
      res.status(200).json({
        message: 'success',
        body: {
          response: 'Checkout URL Notification - Okay',
        },
      });
    }
  }
};
//  klaviyo events for comments
async function sendEmailNotificationForComments(result) {
  let receiverEmail = '';
  if (result[0].receiver_type == constants.roles.admin) {
    receiverEmail = adminEmail;
    receiverName = adminName;
  } else {
    receiverEmail = result[0].receiver_email;
    receiverName = result[0].receiver_name;
  }
  let senderName = '';
  let senderEmail = '';
  if (result[0].sender_type == constants.roles.admin) {
    senderName = adminName;
    senderEmail = adminEmail;
  } else {
    senderName = result[0].sender_name;
    senderEmail = result[0].sender_email;
    receiverEmail = 'testing@p80w.com';
    receiverName = 'Admin';
  }
  let eventName = 'test_template';
  let properties = {};
  properties.$sender_email = senderEmail;
  properties.$sender_name = senderName;
  properties.$receiver_email = receiverEmail;
  properties.$receiver_name = receiverName;
  properties.$order_id = result[0].order_id;
  let draftOrderById = await ShopifyDraftOrderRest.getShopifyDraftOrderById(
    result[0].order_id,
  );
  properties.$order_name = draftOrderById.name;
  properties.$lineItem = [];
  properties.$order_name = draftOrderById['name'];
  if (draftOrderById != '') {
    let arrayLineItems = {};
    for (let row = 0; row < draftOrderById['line_items'].length; row++) {
      if (
        arrayLineItems[draftOrderById['line_items'][row]['product_id']] ===
        undefined
      ) {
        arrayLineItems[draftOrderById['line_items'][row]['product_id']] = [];
      }
      arrayLineItems[draftOrderById['line_items'][row]['product_id']].push(
        draftOrderById['line_items'][row],
      );
    }
    Object.keys(arrayLineItems).forEach(function (key, index) {
      let lineItemObj = {};
      lineItemObj.title = this[key][0]['title'];
      lineItemObj.price = this[key][0]['price'];
      if (this[key][0]['assigned_artwork']) {
        lineItemObj.assigned_artwork = this[key][0]['assigned_artwork'];
      }
      if (this[key][0]['artwork_instruction']) {
        lineItemObj.artwork_instruction = this[key][0]['artwork_instruction'];
      }
      properties.$lineItem.push(lineItemObj);
      lineItemObj.$variants = [];
      for (let row = 0; row < this[key].length; row++) {
        let lineItemVariantsObj = {};
        lineItemVariantsObj.name = this[key][row]['name'];
        lineItemVariantsObj.qty = this[key][row]['quantity'];
        lineItemObj.$variants.push(lineItemVariantsObj);
      }
    }, arrayLineItems);
  }
  properties.$messages = [];
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  for (let row = 0; row < result.length; row++) {
    let messageObj = {};
    messageObj.comment = result[row].comment;
    let year = result[row].created_at.toISOString().slice(0, 4);
    let month = Number(result[row].created_at.toISOString().slice(5, 7));
    let date = result[row].created_at.toISOString().slice(8, 10);
    let created_date = monthNames[month - 1] + ' ' + date + ', ' + year;
    let time = new Intl.DateTimeFormat('default', {
      hour12: true,
      hour: 'numeric',
      minute: 'numeric',
    }).format(new Date(result[row].created_at));
    messageObj.created_at = time + ' ' + created_date;
    if (result[row].receiver_type == constants.roles.admin) {
      messageObj.receiver_email = adminEmail;
      messageObj.receiver_name = adminName;
    } else {
      messageObj.receiver_email = result[row].receiver_email;
      messageObj.receiver_name = result[row].receiver_name;
    }
    if (result[row].sender_type == constants.roles.admin) {
      messageObj.sender_name = adminName;
      messageObj.sender_email = adminEmail;
    } else {
      messageObj.sender_name = result[row].sender_name;
      messageObj.sender_email = result[row].sender_email;
    }
    properties.$messages.push(messageObj);
  }
  let customerProperties = {};
  customerProperties.$name = receiverName;
  let artIds = [];
  let result_array = draftOrderById['tags'].split(',');
  result_array.forEach((tag) => {
    if (tag.includes('artworkID')) {
      let artId = tag.split(':').pop();
      artIds.push(artId);
    }
  });
  artWorkModel.getArtworksByIds(artIds, async (err, arts) => {
    let artworks = '';
    Object.values(arts).forEach((values) => {
      artworks =
        artworks +
        `                                              
			SKU : ` +
        values.id +
        `                                                
			Artwork Name : ` +
        values.artwork_name;
    });
    properties.$arts = artworks;
    klaviyores = klaviyoClient.track(
      eventName,
      receiverEmail,
      properties,
      customerProperties,
    );
    if (result[0].sender_type == constants.roles.salesRepCheck) {
      receiverEmail = result[0].receiver_email;
      properties.$receiver_email = receiverEmail;
      receiverName = result[0].receiver_name;
      properties.$receiver_name = receiverName;
      let klaviyoresSalesrep = klaviyoClient.track(
        eventName,
        receiverEmail,
        properties,
        customerProperties,
      );
    }
    return klaviyores;
  });
}
//  klaviyo events for order create
async function sendEmailNotificationForDraftOrderCreation(result) {
  let receiverEmail = result['customer']['email'];
  let receiverName = result['customer']['first_name'];
  let eventName = 'draft_order_create';
  let properties = {};
  properties.$order_name = result['name'];
  properties.$order_id = result['id'];
  properties.$subtotal_price = result['subtotal_price'];
  properties.$total_tax = result['total_tax'];
  properties.$total_price = result['total_price'];
  properties.$receiverName =
    result['customer']['first_name'] + ' ' + result['customer']['last_name'];
  properties.$lineItem = [];
  properties.$arts = [];
  let arrayLineItems = {};
  for (let row = 0; row < result['line_items'].length; row++) {
    if (arrayLineItems[result['line_items'][row]['product_id']] === undefined) {
      arrayLineItems[result['line_items'][row]['product_id']] = [];
    }
    arrayLineItems[result['line_items'][row]['product_id']].push(
      result['line_items'][row],
    );
  }
  Object.keys(arrayLineItems).forEach(function (key, index) {
    let lineItemObj = {};
    lineItemObj.title = this[key][0]['title'];
    lineItemObj.price = this[key][0]['price'];
    if (this[key][0]['assigned_artwork']) {
      lineItemObj.assigned_artwork = this[key][0]['assigned_artwork'];
    }
    if (this[key][0]['artwork_instruction']) {
      lineItemObj.artwork_instruction = this[key][0]['artwork_instruction'];
    }
    properties.$lineItem.push(lineItemObj);
    lineItemObj.$variants = [];
    for (let row = 0; row < this[key].length; row++) {
      let lineItemVariantsObj = {};
      lineItemVariantsObj.name = this[key][row]['name'];
      lineItemVariantsObj.qty = this[key][row]['quantity'];
      lineItemObj.$variants.push(lineItemVariantsObj);
    }
  }, arrayLineItems);
  if (result['shipping_address']) {
    properties.$shipping_address = [
      {
        name: result['shipping_address']['first_name'],
        address1: result['shipping_address']['address1'],
        city: result['shipping_address']['city'],
        zip: result['shipping_address']['zip'],
        country: result['shipping_address']['country'],
      },
    ];
  }
  if (result['billing_address']) {
    properties.$billing_address = [
      {
        name: result['billing_address']['first_name'],
        address1: result['billing_address']['address1'],
        city: result['billing_address']['city'],
        zip: result['billing_address']['zip'],
        country: result['billing_address']['country'],
      },
    ];
  }
  let customerProperties = {};
  let artIds = [];
  let result_array = result['tags'].split(',');
  result_array.forEach((tag) => {
    if (tag.includes('artworkID')) {
      let artId = tag.split(':').pop();
      artIds.push(artId);
    }
  });
  artWorkModel.getArtworksByIds(artIds, async (err, arts) => {
    let artworks = '';
    Object.values(arts).forEach((values) => {
      artworks =
        artworks +
        `                                              
			SKU : ` +
        values.id +
        `                                                
			Artwork Name : ` +
        values.artwork_name;
    });
    properties.$arts = artworks;
    return klaviyoClient.track(
      eventName,
      receiverEmail,
      properties,
      customerProperties,
    );
  });
}
//  klaviyo events for order create update
async function sendEmailNotificationForUpdateDraftOrderCreation(
  result,
  userRole,
) {
  let receiverEmail = '';
  let receiverName = '';
  if (userRole == constants.roles.admin) {
    receiverEmail = result['customer']['email'];
    receiverName =
      result['customer']['first_name'] + ' ' + result['customer']['last_name'];
  } else if (userRole == constants.roles.customer) {
    receiverName = adminName;
    receiverEmail = adminEmail;
  }
  let eventName = 'order_updated';
  let properties = {};
  properties.$receiver_email = receiverEmail;
  properties.$receiver_name = receiverName;
  properties.$order_id = result['id'];
  properties.$subtotal_price = result['subtotal_price'];
  properties.$total_tax = result['total_tax'];
  properties.$total_price = result['total_price'];
  properties.$name = result['name'];
  properties.$lineItem = [];
  let arrayLineItems = {};
  for (let row = 0; row < result['line_items'].length; row++) {
    if (arrayLineItems[result['line_items'][row]['product_id']] === undefined) {
      arrayLineItems[result['line_items'][row]['product_id']] = [];
    }
    arrayLineItems[result['line_items'][row]['product_id']].push(
      result['line_items'][row],
    );
  }
  Object.keys(arrayLineItems).forEach(function (key, index) {
    let lineItemObj = {};
    lineItemObj.title = this[key][0]['title'];
    lineItemObj.price = this[key][0]['price'];
    if (this[key][0]['assigned_artwork']) {
      lineItemObj.assigned_artwork = this[key][0]['assigned_artwork'];
    }
    if (this[key][0]['artwork_instruction']) {
      lineItemObj.artwork_instruction = this[key][0]['artwork_instruction'];
    }
    properties.$lineItem.push(lineItemObj);
    lineItemObj.$variants = [];
    for (let row = 0; row < this[key].length; row++) {
      let lineItemVariantsObj = {};
      lineItemVariantsObj.name = this[key][row]['name'];
      lineItemVariantsObj.qty = this[key][row]['quantity'];
      lineItemObj.$variants.push(lineItemVariantsObj);
    }
  }, arrayLineItems);
  if (result['shipping_address']) {
    properties.$shipping_address = [
      {
        name: result['shipping_address']['first_name'],
        address1: result['shipping_address']['address1'],
        city: result['shipping_address']['city'],
        zip: result['shipping_address']['zip'],
        country: result['shipping_address']['country'],
      },
    ];
  }
  if (result['billing_address']) {
    properties.$billing_address = [
      {
        name: result['billing_address']['first_name'],
        address1: result['billing_address']['address1'],
        city: result['billing_address']['city'],
        zip: result['billing_address']['zip'],
        country: result['billing_address']['country'],
      },
    ];
  }
  if (result['comment']) {
    properties.$messages = [];
    for (let row = 0; row < result['comment'].length; row++) {
      let messageObj = {};
      messageObj.comment = result['comment'][row]['comment'];
      messageObj.created_at = result['comment'][row]['created_at'];
      if (result[row].receiver_type == constants.roles.admin) {
        messageObj.receiver_email = adminEmail;
        messageObj.receiver_name = adminName;
      } else {
        messageObj.receiver_email = result['comment'][row].receiver_email;
        messageObj.receiver_name = result['comment'][row].receiver_name;
      }
      if (result[row].sender_type == constants.roles.admin) {
        messageObj.sender_name = adminName;
        messageObj.sender_email = adminEmail;
      } else {
        messageObj.sender_name = result['comment'][row].sender_name;
        messageObj.sender_email = result['comment'][row].sender_email;
      }
      properties.$messages.push(messageObj);
    }
  }
  let customerProperties = {};
  return klaviyoClient.track(
    eventName,
    receiverEmail,
    properties,
    customerProperties,
  );
}
//  klaviyo events for check out url
async function sendEmailNotificationForCheckOutUrl(result) {
  let receiverEmail = result['customer']['email'];
  let receiverName = result['customer']['first_name'];
  let eventName = 'check_out_url';
  let properties = {};
  properties.$order_id = result['id'];
  properties.$receiverName =
    result['customer']['first_name'] + ' ' + result['customer']['last_name'];
  properties.$subtotal_price = result['subtotal_price'];
  properties.$total_tax = result['total_tax'];
  properties.$total_price = result['total_price'];
  properties.$invoice_url = result['invoice_url'];
  properties.$lineItem = [];
  let arrayLineItems = {};
  for (let row = 0; row < result['line_items'].length; row++) {
    if (arrayLineItems[result['line_items'][row]['product_id']] === undefined) {
      arrayLineItems[result['line_items'][row]['product_id']] = [];
    }
    arrayLineItems[result['line_items'][row]['product_id']].push(
      result['line_items'][row],
    );
  }
  Object.keys(arrayLineItems).forEach(function (key, index) {
    let lineItemObj = {};
    lineItemObj.title = this[key][0]['title'];
    lineItemObj.price = this[key][0]['price'];
    if (this[key][0]['assigned_artwork']) {
      lineItemObj.assigned_artwork = this[key][0]['assigned_artwork'];
    }
    if (this[key][0]['artwork_instruction']) {
      lineItemObj.artwork_instruction = this[key][0]['artwork_instruction'];
    }
    properties.$lineItem.push(lineItemObj);
    lineItemObj.$variants = [];
    for (let row = 0; row < this[key].length; row++) {
      let lineItemVariantsObj = {};
      lineItemVariantsObj.name = this[key][row]['name'];
      lineItemVariantsObj.qty = this[key][row]['quantity'];
      lineItemObj.$variants.push(lineItemVariantsObj);
    }
  }, arrayLineItems);
  if (result['shipping_address']) {
    properties.$shipping_address = [
      {
        name: result['shipping_address']['first_name'],
        address1: result['shipping_address']['address1'],
        city: result['shipping_address']['city'],
        zip: result['shipping_address']['zip'],
        country: result['shipping_address']['country'],
      },
    ];
  }
  if (result['billing_address']) {
    properties.$billing_address = [
      {
        name: result['billing_address']['first_name'],
        address1: result['billing_address']['address1'],
        city: result['billing_address']['city'],
        zip: result['billing_address']['zip'],
        country: result['billing_address']['country'],
      },
    ];
  }
  let customerProperties = {};
  return klaviyoClient.track(
    eventName,
    receiverEmail,
    properties,
    customerProperties,
  );
}

//  klaviyo events for check out url
async function sendEmailNotificationForOrderApproval(result) {
  let receiverEmail = '';
  let receiverName = '';
  if (result['approved_by'] == constants.roles.admin) {
    receiverEmail = result['customer']['email'];
    receiverName = result['customer']['first_name'];
  } else if (result['approved_by'] == constants.roles.customer) {
    receiverEmail = 'testing@p80w.com';
    receiverName = 'Admin';
  }
  let eventName = 'order_approved';
  let properties = {};
  properties.$order_id = result['id'];
  properties.$approved_by = result['approved_by'];
  properties.$subtotal_price = result['subtotal_price'];
  properties.$total_tax = result['total_tax'];
  properties.$total_price = result['total_price'];
  properties.$invoice_url = result['invoice_url'];
  properties.$lineItem = [];
  let arrayLineItems = {};
  for (let row = 0; row < result['line_items'].length; row++) {
    if (arrayLineItems[result['line_items'][row]['product_id']] === undefined) {
      arrayLineItems[result['line_items'][row]['product_id']] = [];
    }
    arrayLineItems[result['line_items'][row]['product_id']].push(
      result['line_items'][row],
    );
  }
  Object.keys(arrayLineItems).forEach(function (key, index) {
    let lineItemObj = {};
    lineItemObj.title = this[key][0]['title'];
    lineItemObj.price = this[key][0]['price'];
    if (this[key][0]['assigned_artwork']) {
      lineItemObj.assigned_artwork = this[key][0]['assigned_artwork'];
    }
    if (this[key][0]['artwork_instruction']) {
      lineItemObj.artwork_instruction = this[key][0]['artwork_instruction'];
    }
    properties.$lineItem.push(lineItemObj);
    lineItemObj.$variants = [];
    for (let row = 0; row < this[key].length; row++) {
      let lineItemVariantsObj = {};
      lineItemVariantsObj.name = this[key][row]['name'];
      lineItemVariantsObj.qty = this[key][row]['quantity'];
      lineItemObj.$variants.push(lineItemVariantsObj);
    }
  }, arrayLineItems);
  if (result['shipping_address']) {
    properties.$shipping_address = [
      {
        name: result['shipping_address']['first_name'],
        address1: result['shipping_address']['address1'],
        city: result['shipping_address']['city'],
        zip: result['shipping_address']['zip'],
        country: result['shipping_address']['country'],
      },
    ];
  }
  if (result['billing_address']) {
    properties.$billing_address = [
      {
        name: result['billing_address']['first_name'],
        address1: result['billing_address']['address1'],
        city: result['billing_address']['city'],
        zip: result['billing_address']['zip'],
        country: result['billing_address']['country'],
      },
    ];
  }
  let customerProperties = {};
  return klaviyoClient.track(
    eventName,
    receiverEmail,
    properties,
    customerProperties,
  );
}
module.exports = {
  getDraftOrders,
  getDraftOrderById,
  getDraftOrderPreviewsById,
  getDraftOrdersByCustomerId,
  createDraftOrder,
  addOrderInstructions,
  approveDraftOrder,
  updateDraftOrder,
  addDraftOrderComments,
  getDraftOrderComments,
  sendCheckOutUrlById,
};
