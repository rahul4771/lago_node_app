const jwt = require('jsonwebtoken');
require('dotenv').config();
const loggerTrack = require('../Utils/log');
const { graphQlGet } = require('../Utils/graphQLCallManager');
const shopifyCustomerGraphQL = require('../ShopifyGraphQL/customer');
const shopifyDraftOrderGraphQL = require('../ShopifyGraphQL/draftOrder');
const constants = require('../Utils/constants');
const ShopifyRest = require('../ShopifyRest/customer');

//Add customer from admin app
const addCustomers = async function (req, res) {
  const logger = loggerTrack('salesRep/addCustomer');
  logger.info('------------start--------------');
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const email = req.body.email;
  const addRequest = {
    first_name: firstName,
    last_name: lastName,
    email: email,
  };
  let response = null;
  try {
    response = await addShopifyCustomer(addRequest);
  } catch (error) {
    logger.info('Failed to add the customer');
    return false;
  }
  if (response) {
    logger.info('Customer details added successfully');
    logger.info('-------------end-------------');
    return res.status(200).json({
      message: 'success',
      body: {
        created: true,
        message: 'Customer added successfully',
      },
    });
  } else {
    logger.info('Failed to add the customer');
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to add the customer',
      },
    });
  }
};

// get customer by id
const getCustomerDetailsById = async function (req, res) {
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`customer id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  let account_id = null;
  let account_role = null;
  const token = req.header('access-token');
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    account_id = decoded.id;
    account_role = decoded.role;
  });
  const shCustomerId = req.params.id;
  if (account_role == constants.roles.customer && account_id != shCustomerId) {
    res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  if (shCustomerId) {
    const shCustomer = await ShopifyRest.getShopifyCustomerById(shCustomerId);
    if (shCustomer) {
      const name = shCustomer['first_name'] + ' ' + shCustomer['last_name'];
      const result = {
        message: 'success',
        body: {
          name: name,
        },
      };
      return res.status(200).json(result);
    } else {
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to fetch customer details from shopify',
        },
      });
    }
  } else {
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Customer id is empty',
      },
    });
  }
};

// get customer by id
const getCustomerById = async function (req, res) {
  const logger = loggerTrack('customer/getCustomerById');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`customer id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  let account_id = null;
  let account_role = null;
  const token = req.header('access-token');
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    account_id = decoded.id;
    account_role = decoded.role;
  });
  const shCustomerId = req.params.id;
  if (shCustomerId) {
    const shCustomer = await ShopifyRest.getShopifyCustomerById(shCustomerId);
    if (shCustomer) {
      const shCustomerDraftOrders = await getShopifyDraftOrderByCustomerId(
        null,
        null,
        shCustomer['id'],
        account_id,
        account_role,
      );
      let orders = [];
      if (Object.keys(shCustomerDraftOrders).length == 0) {
        orders = null;
      } else {
        for (let j = 0; j < shCustomerDraftOrders.length; j++) {
          let draftOrderId = shCustomerDraftOrders[j]['node'].id
            .split('/')
            .pop();
          orders[j] = {
            id: draftOrderId,
            name: shCustomerDraftOrders[j]['node'].name,
          };
        }
      }
      const name = shCustomer['first_name'] + ' ' + shCustomer['last_name'];
      let billingAddress = null;
      let shippingAddress = null;
      if (
        shCustomer['addresses'][0] &&
        shCustomer['addresses'][0] != undefined
      ) {
        billingAddress = {
          address1: shCustomer['addresses'][0].address1,
          address2: shCustomer['addresses'][0].address2,
          company: shCustomer['addresses'][0].company,
          city: shCustomer['addresses'][0].city,
          province: shCustomer['addresses'][0].province,
          country: shCustomer['addresses'][0].country,
          zip: shCustomer['addresses'][0].zip,
          phone: shCustomer['addresses'][0].phone,
        };
        shippingAddress = {
          address1: shCustomer['addresses'][0].address1,
          address2: shCustomer['addresses'][0].address2,
          company: shCustomer['addresses'][0].company,
          city: shCustomer['addresses'][0].city,
          province: shCustomer['addresses'][0].province,
          country: shCustomer['addresses'][0].country,
          zip: shCustomer['addresses'][0].zip,
          phone: shCustomer['addresses'][0].phone,
        };
      }
      const result = {
        message: 'success',
        body: {
          id: shCustomer['id'],
          name: name,
          first_name: shCustomer['first_name'],
          last_name: shCustomer['last_name'],
          email: shCustomer['email'],
          billing_address: billingAddress,
          shipping_address: shippingAddress,
          phone: shCustomer['phone'],
          total_sales: shCustomer['total_spent'],
          pending_orders: orders,
        },
      };
      logger.info(
        `successfully fetch draft order by customer id :- ${JSON.stringify(
          result,
        )}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(result);
    } else {
      logger.debug(
        `Failed to fetch customer details from shopify :- ${shCustomerId}`,
      );
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to fetch customer details from shopify',
        },
      });
    }
  } else {
    logger.debug(`Missing required parameter customer_id`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Customer id is empty',
      },
    });
  }
};

// get customer's pending orders details by id
const getCustomerPendingOrders = async function (req, res) {
  const logger = loggerTrack('customer/getCustomerPendingOrders');
  logger.info('------------start--------------');
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`customer id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  let account_id = null;
  let account_role = null;
  const token = req.header('access-token');
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    account_id = decoded.id;
    account_role = decoded.role;
  });
  let pageType = 'next';
  let cursor = null;
  if (Object.keys(req.query).length !== 0) {
    if (req.query.previous !== undefined) {
      pageType = 'previous';
      cursor = req.query.previous;
    }
    if (req.query.next !== undefined) {
      pageType = 'next';
      cursor = req.query.next;
    }
  }
  let previousCursor = null;
  let nextCursor = null;
  const shCustomerId = req.params.id;
  if (shCustomerId) {
    const shCustomerDraftOrders = await getShopifyDraftOrderByCustomerId(
      cursor,
      pageType,
      shCustomerId,
      account_id,
      account_role,
    );
    let orders = [];
    if (
      shCustomerDraftOrders &&
      shCustomerDraftOrders.draftOrders == undefined
    ) {
      orders = null;
    } else {
      const pageInfo = shCustomerDraftOrders.draftOrders.pageInfo;
      const shDraftOrders = shCustomerDraftOrders.draftOrders.edges;
      for (let j = 0; j < shDraftOrders.length; j++) {
        if (j == 0 && pageInfo.hasPreviousPage === true) {
          previousCursor = shDraftOrders[j].cursor;
        } else if (
          j + 1 == shDraftOrders.length &&
          pageInfo.hasNextPage === true
        ) {
          nextCursor = shDraftOrders[j].cursor;
        }
        const draftOrderId = shDraftOrders[j]['node'].id.split('/').pop();
        let productId = null;
        if (shDraftOrders[j]['node'].lineItems.length != 0) {
          productId = shDraftOrders[j]['node'].lineItems.edges[0][
            'node'
          ].product.id
            .split('/')
            .pop();
        }
        orders[j] = {
          id: draftOrderId,
          productId: productId,
          name: shDraftOrders[j]['node'].name,
          totalPrice: shDraftOrders[j]['node'].totalPrice,
          tags: shDraftOrders[j]['node'].tags,
        };
      }
    }
    const result = {
      message: 'success',
      body: {
        id: shCustomerId,
        pendingOrders: orders,
        nextCursor: nextCursor,
        previousCursor: previousCursor,
      },
    };
    logger.info(
      `successfully fetch pending order by customer id :- ${JSON.stringify(
        result,
      )}`,
    );
    logger.info('------------end--------------');
    return res.status(200).json(result);
  } else {
    logger.debug(`Missing required parameter customer_id`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Customer id is empty',
      },
    });
  }
};
// get customer
const getCustomers = async function (req, res) {
  const logger = loggerTrack('customer/getCustomers');
  logger.info('------------start--------------');
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole != constants.roles.admin) {
    res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  let pageType = 'next';
  let cursor = null;
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
  }
  let previousCursor = null;
  let nextCursor = null;
  let result = [];
  const customerDetails = await getShopifyCustomers(
    cursor,
    pageType,
    queryString,
  );
  if (customerDetails && customerDetails.customers !== undefined) {
    const pageInfo = customerDetails.customers.pageInfo;
    const shCustomers = customerDetails.customers.edges;
    if (shCustomers) {
      for (let i = 0; i < shCustomers.length; i++) {
        if (i == 0 && pageInfo.hasPreviousPage === true) {
          previousCursor = shCustomers[i].cursor;
        } else if (
          i + 1 == shCustomers.length &&
          pageInfo.hasNextPage === true
        ) {
          nextCursor = shCustomers[i].cursor;
        }
        const customerId = shCustomers[i].node.id.split('/').pop();
        if (Object.keys(shCustomers[i].node.addresses).length == 0) {
          shCustomers[i].node.addresses[0] = null;
        }
        result[i] = {
          id: customerId,
          email: shCustomers[i].node.email,
          name: shCustomers[i].node.displayName,
          billing_address: shCustomers[i].node.addresses[0],
          shipping_address: shCustomers[i].node.defaultAddress,
          total_sales: shCustomers[i].node.totalSpent,
        };
      }
      const resultSet = {
        message: 'success',
        body: {
          customers: result,
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the customer :- ${JSON.stringify(resultSet)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(resultSet);
    } else {
      const resultSet = {
        message: 'success',
        body: {
          customers: [],
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the customer ;- ${JSON.stringify(resultSet)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(resultSet);
    }
  } else {
    logger.debug(`Failed to get the customers`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to get the customers',
      },
    });
  }
};
// get customer
const getAllCustomers = async function (req, res) {
  const logger = loggerTrack('customer/getCustomers');
  logger.info('------------start--------------');
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole != constants.roles.admin) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  let pageType = 'next';
  let cursor = null;
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
  }
  let previousCursor = null;
  let nextCursor = null;
  let result = [];
  const customerDetails = await getAllShopifyCustomers(
    cursor,
    pageType,
    queryString,
  );
  if (customerDetails && customerDetails.customers !== undefined) {
    const pageInfo = customerDetails.customers.pageInfo;
    const shCustomers = customerDetails.customers.edges;
    if (shCustomers) {
      for (let i = 0; i < shCustomers.length; i++) {
        if (i == 0 && pageInfo.hasPreviousPage === true) {
          previousCursor = shCustomers[i].cursor;
        } else if (
          i + 1 == shCustomers.length &&
          pageInfo.hasNextPage === true
        ) {
          nextCursor = shCustomers[i].cursor;
        }
        const customerId = shCustomers[i].node.id.split('/').pop();
        if (Object.keys(shCustomers[i].node.addresses).length == 0) {
          shCustomers[i].node.addresses[0] = null;
        }
        result[i] = {
          id: customerId,
          email: shCustomers[i].node.email,
          name: shCustomers[i].node.displayName,
          billing_address: shCustomers[i].node.addresses[0],
          shipping_address: shCustomers[i].node.defaultAddress,
          total_sales: shCustomers[i].node.totalSpent,
        };
      }
      const resultSet = {
        message: 'success',
        body: {
          customers: result,
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the customer :- ${JSON.stringify(resultSet)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(resultSet);
    } else {
      result = {
        message: 'success',
        body: {
          customers: [],
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the customer ;- ${JSON.stringify(result)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(result);
    }
  } else {
    logger.debug(`Failed to get the customers`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to get the customers',
      },
    });
  }
};

// get sales rep's customers
const getSalesRepsCustomers = async function (req, res) {
  const logger = loggerTrack('customer/getCustomers');
  logger.info('------------start--------------');
  let account_id = null;
  let account_role = null;
  const token = req.header('access-token');
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    account_id = decoded.id;
    account_role = decoded.role;
  });
  if (account_role === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  let pageType = 'next';
  let cursor = null;
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
  }
  let previousCursor = null;
  let nextCursor = null;
  let result = [];
  const customerDetails = await getSalesRepShopifyCustomers(
    cursor,
    pageType,
    queryString,
    account_id,
  );
  if (customerDetails && customerDetails.customers !== undefined) {
    const pageInfo = customerDetails.customers.pageInfo;
    const shCustomers = customerDetails.customers.edges;
    if (shCustomers) {
      for (let i = 0; i < shCustomers.length; i++) {
        if (i == 0 && pageInfo.hasPreviousPage === true) {
          previousCursor = shCustomers[i].cursor;
        } else if (
          i + 1 == shCustomers.length &&
          pageInfo.hasNextPage === true
        ) {
          nextCursor = shCustomers[i].cursor;
        }
        const customerId = shCustomers[i].node.id.split('/').pop();
        if (Object.keys(shCustomers[i].node.addresses).length == 0) {
          shCustomers[i].node.addresses[0] = null;
        }
        result[i] = {
          id: customerId,
          email: shCustomers[i].node.email,
          name: shCustomers[i].node.displayName,
          billing_address: shCustomers[i].node.addresses[0],
          shipping_address: shCustomers[i].node.defaultAddress,
          total_sales: shCustomers[i].node.totalSpent,
        };
      }
      const resultSet = {
        message: 'success',
        body: {
          customers: result,
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the customer :- ${JSON.stringify(resultSet)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(resultSet);
    } else {
      result = {
        message: 'success',
        body: {
          customers: [],
          next_cursor: nextCursor,
          previous_cursor: previousCursor,
        },
      };
      logger.info(
        `Successfully fetched the customer ;- ${JSON.stringify(result)}`,
      );
      logger.info('------------end--------------');
      return res.status(200).json(result);
    }
  } else {
    logger.debug(`Failed to get the customers`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to get the customers',
      },
    });
  }
};
// get customer draft order in shopify
async function getShopifyDraftOrderByCustomerId(
  cursor = null,
  pageType = null,
  customer_id,
  account_id,
  account_role,
) {
  let result = [];
  let arguments = 'first:10, reverse:true';
  if (cursor) {
    if (pageType === 'next') {
      arguments += `, after:"${cursor}"`;
    } else if (pageType === 'previous') {
      arguments = `last:10, reverse:true, before:"${cursor}"`;
    }
  }
  if (customer_id) {
    if (account_role == constants.roles.salesRep) {
      arguments += `, query:"customer_id:${customer_id} AND tag:'createdBy:salesRep:${account_id}'"`;
    } else {
      arguments += `, query:"customer_id:${customer_id}"`;
    }
  }
  result = await graphQlGet(
    shopifyDraftOrderGraphQL.getDraftOrdersIds(arguments),
  );
  return result;
}

// get customer from shopify
async function getShopifyCustomers(cursor, pageType, queryString) {
  let error = null;
  let arguments = 'first:10, reverse:true';
  if (cursor) {
    if (pageType === 'next') {
      arguments += `, after:"${cursor}"`;
    } else if (pageType === 'previous') {
      arguments = `last:10, reverse:true, before:"${cursor}"`;
    }
  }
  arguments += `, query:"-tag:'account:salesRep' AND -state:'DISABLED'`;
  if (queryString) {
    arguments += ` AND ${queryString}`;
  }
  arguments += '"';
  try {
    return await graphQlGet(
      shopifyCustomerGraphQL.getAllShopifyCustomers(arguments),
    );
  } catch (e) {
    const logMessege = Array('error', 'error to get customer', error);
    loggerTrack('customer/errorFetch').debug(logMessege);
    return null;
  }
}

// get customer from shopify
async function getSalesRepShopifyCustomers(
  cursor,
  pageType,
  queryString,
  account_id,
) {
  let arguments = 'first:10, reverse:true';
  if (cursor) {
    if (pageType === 'next') {
      arguments += `, after:"${cursor}"`;
    } else if (pageType === 'previous') {
      arguments = `last:10, reverse:true, before:"${cursor}"`;
    }
  }
  if (account_id) {
    arguments += `, query:"tag:'salesRep:${account_id}'`;
  }
  if (queryString) {
    arguments += ` AND ${queryString}`;
  }
  arguments += '"';
  try {
    return await graphQlGet(
      shopifyCustomerGraphQL.getAllShopifyCustomers(arguments),
    );
  } catch (e) {
    const logMessege = Array('error', 'error to get customer', e);
    loggerTrack('customer/errorFetch').debug(logMessege);
    return null;
  }
}
// get customer from shopify
async function getAllShopifyCustomers(cursor, pageType, queryString) {
  let arguments = 'first:100, reverse:true';
  arguments += `, query:"-tag:'account:salesRep' AND -state:'DISABLED'`;
  if (queryString) {
    arguments += ` AND ${queryString}`;
  }
  arguments += '"';

  try {
    return await graphQlGet(
      shopifyCustomerGraphQL.getAllShopifyCustomers(arguments),
    );
  } catch (e) {
    const logMessege = Array('error', 'error to get customer', e);
    loggerTrack('customer/errorFetch').debug(logMessege);
    return null;
  }
}
// get list of customer from shopify
const getListCustomers = async function (req, res) {
  const logger = loggerTrack('customer/getListCustomers');
  let result = [];
  let queryString = null;
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole != constants.roles.admin) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  if (req.query.query !== undefined) {
    queryString = req.query.query;
  }
  const customerDetails = await getCustomersList(queryString);
  if (customerDetails) {
    const shCustomers = customerDetails;
    if (shCustomers.length) {
      for (let i = 0; i < shCustomers.length; i++) {
        let customerId = shCustomers[i].node.id.split('/').pop();
        result[i] = {
          value: customerId,
          label: shCustomers[i].node.displayName,
        };
      }
      result = {
        message: 'success',
        body: {
          customers: result,
        },
      };
      return res.status(200).json(result);
    } else {
      result = {
        message: 'success',
        body: {
          customers: [],
        },
      };
      return res.status(200).json(result);
    }
  }
  logger.debug(`Failed to get the customers`);
  return res.status(600).json({
    message: 'error',
    body: {
      error: 'Failed to get the customers',
    },
  });
};

// get customer list shopify
async function getCustomersList(queryString) {
  let arguments = `first: 100, reverse:true, query:"-tag:'account:salesRep' AND -state:'DISABLED'`;
  if (queryString) {
    arguments += ` AND ${queryString}`;
  }
  arguments += `"`;

  try {
    const result = await graphQlGet(
      shopifyCustomerGraphQL.getCustomerData(arguments),
    );
    const customers = result.customers.edges;
    return customers;
  } catch (e) {
    return null;
  }
}

//add customer to Shopify
async function addShopifyCustomer(data) {
  let arguments = `{ email: "${data.email}", firstName: "${data.first_name}", lastName: "${data.last_name}" }`;
  try {
    return await graphQlGet(shopifyCustomerGraphQL.createCustomer(arguments));
  } catch (e) {
    return null;
  }
}

module.exports = {
  addCustomers,
  getCustomerDetailsById,
  getCustomerById,
  getCustomerPendingOrders,
  getCustomers,
  getSalesRepsCustomers,
  getAllCustomers,
  getListCustomers,
};
