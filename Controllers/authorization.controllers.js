require('dotenv').config();
const jwt = require('jsonwebtoken');
const Auth = require('../Models/authorization');
const loggerSuccess = require('../Utils/log')('authorization/successAuth');
const loggerError = require('../Utils/log')('authorization/errorAuth');
const Klaviyo = require('klaviyo-node');
const klaviyoClient = new Klaviyo(process.env.KLAVIYO_KEY);
const { shopify } = require('../Utils/shopifyConnect');
const constants = require('../Utils/constants');
const ShopifyCustomerRest = require('../ShopifyRest/customer');

// generate token
function generateToken(shCustomer, role) {
  const token = jwt.sign(
    {
      id: shCustomer.id,
      email: shCustomer.email,
      first_name: shCustomer.first_name,
      last_name: shCustomer.last_name,
      role: role,
    },
    process.env.JWT_SECRET,
    { expiresIn: 84000 },
  );
  return token;
}

const customerLogin = async function (req, res) {
  const shCustomerId = req.body.id;
  const emailId = req.body.email;
  const salesRepTag = 'account:salesRep';
  const shCustomer = await ShopifyCustomerRest.getShopifyCustomerById(
    shCustomerId,
  );
  const salesRepFlag = shCustomer.tags.includes(salesRepTag);
  const type = salesRepFlag
    ? constants.roles.salesRep
    : constants.roles.customer;
  const customerRole = salesRepFlag ? 2 : 3;
  if (shCustomer && shCustomer.email != emailId) {
    logMessege = Array('error', 'Failed to varify the user'.shCustomerId);
    loggerError.debug(logMessege);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to varify the user',
      },
    });
  } else {
    Auth.checkCustomer(req, function (err, result) {
      if (err) {
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to varify the user',
          },
        });
      } else if (result && result != '') {
        let token = generateToken(shCustomer, type);
        logMessege = Array('success', 'Success to get create token');
        loggerSuccess.info(logMessege);
        return res.status(200).json({
          message: 'success',
          body: {
            access_token: token,
          },
        });
      } else {
        const cust_name = shCustomer.first_name + ' ' + shCustomer.last_name;
        const insertData = {
          shopifyCustomerId: shCustomerId,
          role: customerRole,
          name: cust_name,
        };
        Auth.insertCustomer(insertData, (err, result) => {
          if (err) {
            logMessege = Array('error', 'Failed to varify the user');
            loggerError.debug(logMessege);
            return res.status(600).json({
              message: 'error',
              body: {
                error: 'Failed to varify the user',
              },
            });
          } else if (result && result != '') {
            let token = generateToken(shCustomer, type);
            logMessege = Array('success', 'Success to access-token');
            loggerSuccess.info(logMessege);
            return res.status(200).json({
              message: 'success',
              body: {
                access_token: token,
              },
            });
          }
        });
      }
    });
  }
};
const createCustomer = async function (req, res) {
  const shCustomerId = req.body.id;
  const emailId = req.body.email;
  let shCustomer = null;
  try {
    shCustomer = await ShopifyCustomerRest.getShopifyCustomerById(shCustomerId);
  } catch (e) {
    logMessege = Array('error', 'error to get shopify customer', e);
    loggerError.debug(logMessege);
    return null;
  }
  if (shCustomer && shCustomer.email != emailId) {
    logMessege = Array('error', 'Failed to varify the user'.shCustomerId);
    loggerError.debug(logMessege);
    return res.status(600).json({
      message: 'error',
      body: {
        error: 'Failed to varify the user',
      },
    });
  } else {
    const salesRepTag = 'account:salesRep';
    const salesRepFlag = shCustomer.tags.includes(salesRepTag);
    const customerRole = salesRepFlag ? 2 : 3;
    Auth.checkCustomer(req, function (err, result) {
      if (err) {
        return res.status(600).json({
          message: 'error',
          body: {
            error: 'Failed to varify the user',
          },
        });
      } else if (result.length == 0) {
        const cust_name = shCustomer.first_name + ' ' + shCustomer.last_name;
        const insertData = {
          shopifyCustomerId: shCustomerId,
          role: customerRole,
          name: cust_name,
        };
        Auth.insertCustomer(insertData, async (err, result) => {
          if (err) {
            logMessege = Array('error', 'Failed to varify the user');
            loggerError.debug(logMessege);
            return res.status(600).json({
              message: 'error',
              body: {
                error: 'Failed to varify the user',
              },
            });
          } else if (result != '') {
            logMessege = Array(
              'success',
              'Successfully added customer to database',
            );
            loggerSuccess.info(logMessege);
            await sendEmailNotificationOnCustomerCreation(shCustomer);
            return res.status(200).json({
              message: 'success',
            });
          }
        });
      }
    });
  }
};
//  klaviyo events for customer creation
async function sendEmailNotificationOnCustomerCreation(result) {
  const receiverEmail = result['email'];
  const receiverName = result['first_name'] + ' ' + result['last_name'];
  const eventName = 'customer_created';
  const salesRepTag = 'account:salesRep';
  const salesRepFlag = result.tags.includes(salesRepTag);
  const type = salesRepFlag ? 'Sales Rep' : 'Customer';
  const properties = {
    $shCustomer_id: result['id'],
    $email_id: result['email'],
    $receiverName: receiverName,
    $type: type,
  };
  const customerProperties = {};
  return klaviyoClient.track(
    eventName,
    receiverEmail,
    properties,
    customerProperties,
  );
}
module.exports = {
  customerLogin,
  createCustomer,
};
