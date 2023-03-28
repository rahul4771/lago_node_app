const Klaviyo = require('klaviyo-node');
const klaviyoClient = new Klaviyo(process.env.KLAVIYO_KEY);
require('dotenv').config();
const jwt = require('jsonwebtoken');
const loggerTrack = require('../Utils/log');
const { graphQlGet } = require('../Utils/graphQLCallManager');
const shopifyCustomerGraphQL = require('../ShopifyGraphQL/customer');
const shopifyDraftOrderGraphQL = require('../ShopifyGraphQL/draftOrder');
const shopifyOrderGraphQL = require('../ShopifyGraphQL/order');
const constants = require('../Utils/constants');
const ShopifyCustomerRest = require('../ShopifyRest/customer');

const getSalesRepById = async function (req, res) {
  const logger = loggerTrack('saleRep/getSalesRepById');
  logger.info('------------start--------------');
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`sales_rep id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  const shCustomerId = req.params.id;
  if (shCustomerId) {
    const shCustomer = await ShopifyCustomerRest.getShopifyCustomerById(
      shCustomerId,
    );
    if (shCustomer) {
      const srCustomers = await getSaleRepsCustomersById(shCustomerId);
      let saleRepCustomer = [];
      if (srCustomers) {
        for (let j = 0; j < srCustomers.length; j++) {
          saleRepCustomer[j] = {
            id: srCustomers[j].id.split('/').pop(),
            name: srCustomers[j].displayName,
          };
        }
      }
      const name = shCustomer['first_name'] + ' ' + shCustomer['last_name'];
      const salesRepOrders = await getSalesRepDraftOrdersFromShopify(
        shCustomerId,
      );
      const orderDetails = salesRepOrders.draftOrders.edges;
      let lifetime_sales = 0;
      let this_month_sales = 0;
      let last_month_sales = 0;
      let this_year_sales = 0;
      let customer_order = [];
      const cur_date = new Date();
      const dateYear = cur_date.toISOString().slice(0, 4);
      const dateMonth = cur_date.toISOString().slice(5, 7);
      const last_month_date = new Date(
        cur_date.setMonth(cur_date.getMonth() - 1),
      );
      const lastMonth = last_month_date.toISOString().slice(5, 7);
      Object.values(orderDetails).forEach((val) => {
        let customer_name = val.node.customer.displayName;
        if (customer_order && Object.values(customer_order).length != 0) {
          let check = true;
          Object.keys(customer_order).forEach((key) => {
            if (customer_order[key].customer_name == customer_name) {
              check = false;
              if (customer_order[key].last_order > val.node.createdAt) {
                customer_order[key].last_order = val.node.createdAt;
              }
              customer_order[key].lifetime_sales += Number(val.node.totalPrice);
              customer_order[key].order_count += 1;
            }
          });
          if (check) {
            customer_order.push({
              customer_name: customer_name,
              last_order: val.node.createdAt,
              order_count: 1,
              lifetime_sales: Number(val.node.totalPrice),
            });
          }
        } else {
          customer_order.push({
            customer_name: customer_name,
            last_order: val.node.createdAt,
            order_count: 1,
            lifetime_sales: Number(val.node.totalPrice),
          });
        }
        year = val.node.createdAt.slice(0, 4);
        month = val.node.createdAt.slice(5, 7);
        customerId = val.node.customer.id;
        if (dateYear == year) {
          this_year_sales += Number(val.node.totalPrice);
        }
        if (dateMonth == dateMonth) {
          this_month_sales += Number(val.node.totalPrice);
        }
        if (dateMonth == lastMonth) {
          last_month_sales += Number(val.node.totalPrice);
        }
        lifetime_sales += Number(val.node.totalPrice);
      });
      const result = {
        message: 'success',
        body: {
          id: shCustomer['id'],
          name: name,
          first_name: shCustomer['first_name'],
          last_name: shCustomer['last_name'],
          email: shCustomer['email'],
          phone: shCustomer['phone'],
          sales_rep_customers: saleRepCustomer,
          this_year_sales: this_year_sales,
          this_month_sales: this_month_sales,
          last_month_sales: last_month_sales,
          lifetime_sales: lifetime_sales,
          customer_order: customer_order,
        },
      };
      logger.info(
        `Successfully fetch sales rep by id :- ${JSON.stringify(result)}`,
      );
      return res.status(200).json(result);
    } else {
      logger.debug(
        `Failed to fetch customer details from shopify :- ${shCustomerId}`,
      );
      return res.status(600).json({
        message: 'error',
        data: {
          error: 'Failed to fetch customer details from shopify',
        },
      });
    }
  } else {
    logger.debug(`Missing required parameter customer_id`);
    return res.status(600).json({
      message: 'error',
      data: {
        error: 'Customer id is empty',
      },
    });
  }
};

const getCustomersBySalesRepId = async function (req, res) {
  const logger = loggerTrack('saleRep/getSalesRepById');
  logger.info('------------start--------------');
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`sales_rep id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  let queryString = null;
  if (Object.keys(req.query).length !== 0) {
    if (req.query.query !== undefined) {
      queryString = req.query.query;
    }
  }
  const shCustomerId = req.params.id;
  if (shCustomerId) {
    const shCustomer = await ShopifyCustomerRest.getShopifyCustomerById(
      shCustomerId,
    );
    if (shCustomer) {
      const srCustomers = await getSaleRepsCustomersSearchById(
        shCustomerId,
        queryString,
      );
      let saleRepCustomer = [];
      if (srCustomers) {
        for (let j = 0; j < srCustomers.length; j++) {
          saleRepCustomer[j] = {
            id: srCustomers[j].id.split('/').pop(),
            name: srCustomers[j].displayName,
          };
        }
      }
      const name = shCustomer['first_name'] + ' ' + shCustomer['last_name'];
      const salesRepOrders = await getSalesRepDraftOrdersFromShopify(
        shCustomerId,
      );
      const orderDetails = salesRepOrders.draftOrders.edges;
      let lifetime_sales = 0;
      let this_month_sales = 0;
      let last_month_sales = 0;
      let this_year_sales = 0;
      let customer_order = [];
      const cur_date = new Date();
      const dateYear = cur_date.toISOString().slice(0, 4);
      const dateMonth = cur_date.toISOString().slice(5, 7);
      const last_month_date = new Date(
        cur_date.setMonth(cur_date.getMonth() - 1),
      );
      const lastMonth = last_month_date.toISOString().slice(5, 7);
      Object.values(orderDetails).forEach((val) => {
        let customer_name = val.node.customer.displayName;
        if (customer_order && Object.values(customer_order).length != 0) {
          let check = true;
          Object.keys(customer_order).forEach((key) => {
            if (customer_order[key].customer_name == customer_name) {
              check = false;
              if (customer_order[key].last_order > val.node.createdAt) {
                customer_order[key].last_order = val.node.createdAt;
              }
              customer_order[key].lifetime_sales += Number(val.node.totalPrice);
              customer_order[key].order_count += 1;
            }
          });
          if (check) {
            customer_order.push({
              customer_name: customer_name,
              last_order: val.node.createdAt,
              order_count: 1,
              lifetime_sales: Number(val.node.totalPrice),
            });
          }
        } else {
          customer_order.push({
            customer_name: customer_name,
            last_order: val.node.createdAt,
            order_count: 1,
            lifetime_sales: Number(val.node.totalPrice),
          });
        }
        let year = val.node.createdAt.slice(0, 4);
        let month = val.node.createdAt.slice(5, 7);
        if (dateYear == year) {
          this_year_sales += Number(val.node.totalPrice);
        }
        if (dateMonth == month && dateYear == year) {
          this_month_sales += Number(val.node.totalPrice);
        }
        if (lastMonth == Number(month) - 1 && dateYear == year) {
          last_month_sales += Number(val.node.totalPrice);
        }
        lifetime_sales += Number(val.node.totalPrice);
      });
      result = {
        message: 'success',
        body: {
          id: shCustomer['id'],
          name: name,
          first_name: shCustomer['first_name'],
          last_name: shCustomer['last_name'],
          email: shCustomer['email'],
          phone: shCustomer['phone'],
          sales_rep_customers: saleRepCustomer,
          this_year_sales: this_year_sales,
          this_month_sales: this_month_sales,
          last_month_sales: last_month_sales,
          lifetime_sales: lifetime_sales,
          customer_order: customer_order,
        },
      };
      logger.info(
        `Successfully fetch sales rep by id :- ${JSON.stringify(result)}`,
      );
      return res.status(200).json(result);
    } else {
      logger.debug(
        `Failed to fetch customer details from shopify :- ${shCustomerId}`,
      );
      return res.status(600).json({
        message: 'error',
        data: {
          error: 'Failed to fetch customer details from shopify',
        },
      });
    }
  } else {
    logger.debug(`Missing required parameter customer_id`);
    return res.status(600).json({
      message: 'error',
      data: {
        error: 'Customer id is empty',
      },
    });
  }
};

const getSalesReps = async function (req, res) {
  const logger = loggerTrack('saleRep/getSalesReps');
  logger.info('------------start--------------');
  let pageType = 'next';
  let cursor = null;
  let queryString = null;
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
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
    const customerDetails = await getShopifySalesReps(
      cursor,
      pageType,
      queryString,
    );
    const shSalesRepCount = customerDetails.customers.edges.length;
    if (customerDetails && customerDetails.customers !== undefined) {
      const pageInfo = customerDetails.customers.pageInfo;
      const shCustomers = customerDetails.customers.edges;
      if (shCustomers) {
        for (let i = 0; i < shCustomers.length; i++) {
          if (i == 0 && pageInfo.hasPreviousPage == true) {
            previousCursor = shCustomers[i].cursor;
          } else if (
            i + 1 == shCustomers.length &&
            pageInfo.hasNextPage == true
          ) {
            nextCursor = shCustomers[i].cursor;
          }
          const customerId = shCustomers[i].node.id.split('/').pop();
          const salesRepsCustomers = await getSaleRepsCustomersCountById(
            customerId,
          );
          const srCustomers = await getSaleRepsCustomersOrders(customerId);
          let lifetimeSales = 0;
          if (srCustomers && srCustomers.length > 0) {
            for (let j = 0; j < srCustomers.length; j++) {
              lifetimeSales = Number(
                Number(lifetimeSales) + Number(srCustomers[j].totalPrice),
              );
            }
          }
          result[i] = {
            id: customerId,
            email: shCustomers[i].node.email,
            name: shCustomers[i].node.displayName,
            total_customers: salesRepsCustomers,
            lifetime_sales: lifetimeSales,
          };
        }
        const reResult = {
          message: 'success',
          body: {
            sales_reps: result,
            next_cursor: nextCursor,
            previous_cursor: previousCursor,
            shSalesRepCount: shSalesRepCount,
          },
        };
        logger.info(
          `Successfully fetched the sales rep :- ${JSON.stringify(reResult)}`,
        );
        logger.info('------------end--------------');
        return res.status(200).json(reResult);
      } else {
        result = {
          message: 'success',
          body: {
            sales_reps: [],
            next_cursor: nextCursor,
            previous_cursor: previousCursor,
          },
        };
        logger.info(
          `Successfully fetched the sales rep :- ${JSON.stringify(result)}`,
        );
        logger.info('------------end--------------');
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

// get customer from shopify
async function getShopifySalesReps(cursor, pageType, queryString) {
  let arguments = 'first:10, reverse:true';
  if (cursor) {
    if (pageType === 'next') {
      arguments += `, after:"${cursor}"`;
    } else if (pageType === 'previous') {
      arguments = `last:10, reverse:true, before:"${cursor}"`;
    }
  }
  if (queryString) {
    queryString += `, tag:'account:salesRep'`;
    arguments += `, query:"${queryString}"`;
  } else {
    queryString = `tag:'account:salesRep'`;
    arguments += `, query:"${queryString}"`;
  }
  return await graphQlGet(shopifyCustomerGraphQL.getCustomerData(arguments));
}

async function getSaleRepsCustomersOrders(customerId) {
  let srCustomers = [];
  let arguments = 'first:100, reverse:true';
  arguments += ', query:"status:open';
  arguments += ` AND tag:'createdBy:salesRep:${customerId}'`;
  arguments += '"';
  try {
    const result = await graphQlGet(
      shopifyDraftOrderGraphQL.getDraftOrdersIds(arguments),
    );
    const customers = result.draftOrders.edges;
    Object.values(customers).forEach((val) => {
      cursor = val.cursor;
      srCustomers.push(val.node);
    });
    return srCustomers;
  } catch (e) {
    return null;
  }
}

async function getSaleRepsCustomersById(customerId) {
  let cursor = null;
  let srCustomers = [];
  let query = '';
  do {
    let arguments = `first:100, reverse:true, query:"tag:'salesRep:${customerId}'"`;
    if (cursor != null) {
      arguments += `, after: "` + cursor + `"`;
    }

    try {
      let result = await graphQlGet(
        shopifyCustomerGraphQL.getCustomerData(arguments),
      );
      let customers = result.customers.edges;
      Object.values(customers).forEach((val) => {
        cursor = val.cursor;
        srCustomers.push(val.node);
      });
      if (result.customers.pageInfo.hasNextPage == false) {
        return srCustomers;
      }
    } catch (e) {
      return null;
    }
  } while (result.customers.pageInfo.hasNextPage == true);
}

async function getSaleRepsCustomersCountById(customerId) {
  let arguments = `first:100, reverse:true, query:"tag:'salesRep:${customerId}'"`;
  try {
    let result = await graphQlGet(
      shopifyCustomerGraphQL.getCustomerData(arguments),
    );
    let customers = result.customers.edges;
    customers = customers.length;
    return customers;
  } catch (e) {
    return null;
  }
}

async function getSaleRepsCustomersSearchById(customerId, queryString) {
  let srCustomers = [];
  let query = '';
  let arguments = 'first:100, reverse:true';
  if (queryString) {
    arguments += `, query:"tag:'salesRep:${customerId}' AND ${queryString}"`;
  } else {
    arguments += `, query:"tag:'salesRep:${customerId}'"`;
  }
  do {
    try {
      let result = await graphQlGet(
        shopifyCustomerGraphQL.getCustomerData(arguments),
      );
      let customers = result.customers.edges;
      Object.values(customers).forEach((val) => {
        cursor = val.cursor;
        srCustomers.push(val.node);
      });
      if (result.customers.pageInfo.hasNextPage == false) {
        return srCustomers;
      }
    } catch (e) {
      return null;
    }
  } while (result.customers.pageInfo.hasNextPage == true);
}

const updateSaleRep = async function (req, res) {
  const logger = loggerTrack('salesRep/updateSalesRep');
  logger.info('------------start--------------');
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });

  if (userRole === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`sales_rep id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  const shCustomerId = req.params.id;
  const tag = 'salesRep:' + shCustomerId;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const email = req.body.email;
  const newCustomers = req.body.newCustomers;
  const removedCustomers = req.body.removedCustomers;
  const updateRequest = {
    first_name: firstName,
    last_name: lastName,
    email: email,
  };
  let response = null;
  try {
    response = await ShopifyCustomerRest.updateShopifyCustomer(
      shCustomerId,
      updateRequest,
    );
  } catch (error) {
    logger.info('Failed to update the sales rep');
    return false;
  }
  if (response) {
    if (newCustomers.length || removedCustomers.length) {
      let flag = true;
      if (newCustomers.length) {
        let addTags = await addCutomerTag(newCustomers, email, tag);
        if (addTags == false) {
          flag = false;
        }
      }
      if (removedCustomers.length) {
        let removeTags = await removeCutomerTag(removedCustomers, tag);
        if (removeTags == false) {
          flag = false;
        }
      }
      if (flag) {
        logger.info('Sales rep details updated successfully');
        logger.info('-------------end-------------');
        return res.status(200).json({
          message: 'success',
          body: {
            created: true,
            message: 'Sales rep details updated successfully',
          },
        });
      } else {
        logger.info('Failed to update the tags to customer');
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to update the tags to customer',
          },
        });
      }
    } else {
      return res.status(200).json({
        message: 'success',
        body: {
          updated: true,
          message: 'Sales rep details updated successfully',
        },
      });
    }
  } else {
    logger.info('Failed to add the tags to customer');
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to add the tags to customer',
      },
    });
  }
};
//Add sales rep
const addSalesRep = async function (req, res) {
  const logger = loggerTrack('salesRep/addSalesRep');
  logger.info('------------start--------------');
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const email = req.body.email;
  const newCustomers = req.body.newCustomers;
  const addRequest = {
    firstName: firstName,
    lastName: lastName,
    email: email,
  };
  let tag = null;
  const token = req.header('access-token');
  let userRole = null;
  let response = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  try {
    response = await addShopifySalesRep(addRequest);
    let shCustomerId = response.customerCreate.customer.id.split('/').pop();
    let updateRequest = {
      tags: 'account:salesRep',
    };
    await ShopifyCustomerRest.updateShopifyCustomer(
      shCustomerId,
      updateRequest,
    );
    tag = 'salesRep:' + shCustomerId;
  } catch (error) {
    console.log(error);
    logger.info('Failed to add the sales rep');
    return false;
  }
  if (response) {
    if (newCustomers.length) {
      let flag = true;
      if (newCustomers.length) {
        let addTags = await addCutomerTag(newCustomers, email, tag);
        if (addTags == false) {
          flag = false;
        }
      }
      if (flag) {
        logger.info('Sales rep details updated successfully');
        logger.info('-------------end-------------');
        return res.status(200).json({
          message: 'success',
          body: {
            created: true,
            message: 'Sales rep details updated successfully',
          },
        });
      } else {
        logger.info('Failed to update the tags to customer');
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to update the tags to customer',
          },
        });
      }
    } else {
      return res.status(200).json({
        message: 'success',
        body: {
          updated: true,
          message: 'Sales rep details updated successfully',
        },
      });
    }
  } else {
    logger.info('Failed to add the tags to customer');
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to add the tags to customer',
      },
    });
  }
};

//add sales rep to SHopify
async function addShopifySalesRep(data) {
  try {
    return await graphQlGet(shopifyCustomerGraphQL.createCustomer(data));
  } catch (e) {
    return null;
  }
}

async function addCutomerTag(newCustomers, salesRepEmail, newTag) {
  const logger = loggerTrack('salesRep/addCustomers');
  logger.info('------------start--------------');
  let notificationCustomers = [];
  if (newCustomers.length) {
    for (let i = 0; i < newCustomers.length; i++) {
      let id = newCustomers[i];
      let customers = await ShopifyCustomerRest.getShopifyCustomerById(id);
      let tags = customers.tags;
      if (tags.includes(newTag) == false) {
        tags = tags + ',' + newTag;
        let updateRequest = {
          tags: tags,
        };
        try {
          response = await ShopifyCustomerRest.updateShopifyCustomer(
            id,
            updateRequest,
          );
          if (response) {
            let customer = {};
            customer.id = response.id;
            customer.email = response.email;
            customer.firstName = response.first_name;
            customer.lastName = response.last_name;
            notificationCustomers.push(customer);
          }
        } catch (e) {
          logger.info('Failed to add the tags to customer');
          return false;
        }
      }
    }
    if (notificationCustomers.length != 0) {
      try {
        await sendEmailNotificationToSalesRep(
          notificationCustomers,
          salesRepEmail,
        );
      } catch (e) {
        logger.debug(`Failed to create klaviyo event: ${e}`);
      }
    }
    return true;
  }
}

async function removeCutomerTag(removedCustomers, newTag) {
  if (removedCustomers.length) {
    for (let i = 0; i < removedCustomers.length; i++) {
      let id = removedCustomers[i];
      let customers = await ShopifyCustomerRest.getShopifyCustomerById(id);
      let tags = customers.tags;
      if (tags.includes(newTag)) {
        let tagArray = tags.split(',');
        for (let i = 0; i < tagArray.length; i++) {
          if (tagArray[i].includes(newTag)) {
            tagArray.splice(i, 1);
            break;
          }
        }
        tags = tagArray.join(',');
        let updateRequest = {
          tags: tags,
        };
        try {
          response = await ShopifyCustomerRest.updateShopifyCustomer(
            id,
            updateRequest,
          );
          if (i + 1 == removedCustomers.length) {
            return true;
          }
        } catch (e) {
          logger.info('Failed to remove the tags to customer');
          return false;
        }
      }
    }
  }
}

const removeSalesRepById = async function (req, res) {
  const logger = loggerTrack('salesRep/removeSalesRepById');
  logger.info('------------start--------------');
  const token = req.header('access-token');
  let userRole = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
  });
  if (userRole === constants.roles.customer) {
    return res.status(401).send({
      status: 'error',
      body: {
        error: 'Access Denied!',
      },
    });
  }
  if (Object.keys(req.params).length === 0 || req.params.id === undefined) {
    logger.debug(`sales_rep id is required`);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'customer id is required',
      },
    });
  }
  const shCustomerId = req.params.id;
  const tag = 'salesRep:' + shCustomerId;
  const existingCustomer = req.body.existingCustomer;
  const draftOrderDetails = await getDraftorders(shCustomerId);
  const orderDetails = await getOrders(shCustomerId);
  const draftOrderCount = draftOrderDetails
    ? draftOrderDetails.draftOrders.edges.length
    : 0;
  const orderCount = orderDetails ? orderDetails.orders.edges.length : 0;
  let response = null;
  if (draftOrderCount == 0 && orderCount == 0) {
    try {
      response = await ShopifyCustomerRest.deleteShopifyCustomer(shCustomerId);
    } catch (error) {
      logger.info('Failed to remove the sales rep');
      return false;
    }
    if (response) {
      if (existingCustomer.length > 0) {
        let removeTags = await removeCutomerTag(existingCustomer, tag);
        if (removeTags) {
          logger.info('Sales rep details updated successfully');
          logger.info('-------------end-------------');
          return res.status(200).json({
            message: 'success',
            body: {
              created: true,
              message: 'Sales rep details updated successfully',
            },
          });
        } else {
          logger.info('Failed to update the tags to customer');
          return res.status(600).json({
            message: 'error',
            body: {
              error: 'Failed to update the tags to customer',
            },
          });
        }
      } else {
        logger.info('Sales rep details removed successfully');
        logger.info('-------------end-------------');
        return res.status(200).json({
          message: 'success',
          body: {
            created: true,
            message: 'Sales rep details removed successfully',
          },
        });
      }
    } else {
      logger.info('Failed to update the tags to customer');
      return res.status(600).json({
        message: 'error',
        body: {
          error: 'Failed to update the tags to customer',
        },
      });
    }
  } else {
    logger.info('Failed to remove the sales rep');
    let errorMsg = '';
    if (draftOrderCount > 0) {
      errorMsg = 'Sales rep have draft orders';
    }
    if (orderCount > 0) {
      errorMsg = 'Sales rep have orders';
    }
    if (draftOrderCount > 0 && orderCount > 0) {
      errorMsg = 'Sales rep have orders and draft orders';
    }
    return res.status(600).json({
      message: 'error',
      body: {
        error: errorMsg,
      },
    });
  }
};

//get draftOrder count by salesrep id
async function getDraftorders(salesRepId) {
  let arguments = `first: 100, reverse:true, query:"tag:'createdBy:salesRep:${salesRepId}'"`;
  try {
    const result = await graphQlGet(
      shopifyDraftOrderGraphQL.getDraftOrdersIds(arguments),
    );
    return result;
  } catch (e) {
    return null;
  }
}

//get order count by salesrep id
async function getOrders(salesRepId) {
  let arguments = `first: 100, reverse:true, query:"tag:'createdBy:salesRep:${salesRepId}'"`;
  try {
    const result = await graphQlGet(shopifyOrderGraphQL.getOrders(arguments));
    return result;
  } catch (e) {
    return null;
  }
}

// get draft orders from shopify
async function getSalesRepDraftOrdersFromShopify(salesRepId) {
  let arguments = 'first:100, reverse:true';
  arguments += ', query:"status:open';
  if (salesRepId) {
    arguments += ` AND tag:'createdBy:salesRep:${salesRepId}'`;
  }
  arguments += '"';
  try {
    let result = await graphQlGet(
      shopifyDraftOrderGraphQL.getDraftOrders(arguments),
    );
    return result;
  } catch (e) {
    if (e.Error) {
      setTimeout(async () => {
        let result = await graphQlGet(query);
        return result;
      }, 2000);
    }
  }
}
function sendEmailNotificationToSalesRep(customer, receiverEmail) {
  const eventName = 'sales_rep_customer_notification';
  let customerProperties = {};
  customerProperties.customers = customer;
  return klaviyoClient.track(eventName, receiverEmail, customerProperties);
}
module.exports = {
  getSalesRepById,
  getCustomersBySalesRepId,
  getSalesReps,
  addSalesRep,
  updateSaleRep,
  removeSalesRepById,
};
