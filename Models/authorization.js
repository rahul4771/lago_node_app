const conn = require('../dbConnection');
const moment = require('moment');
const mysql2Client = require('../Database/client');
const { select, insert, update, remove } = require('../Database/queries');

// checking the customer is already exist in the table
const checkCustomer = (req, callback) => {
  const shCustomerId = req.body.id;
  conn
    .query(select.customer.checkCustomer, {
      replacements: [shCustomerId],
      type: conn.QueryTypes.SELECT,
    })
    .then(function (result, err) {
      if (err) return callback(err, null);
      else return callback(null, result);
    });
};

// insert customer
const insertCustomer = (data, callback) => {
  const shCustomerId = data.shopifyCustomerId;
  const shCustomerName = data.name;
  const role = data.role;
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
  conn
    .query(insert.customer.insertCustomer, {
      replacements: [shCustomerId, shCustomerName, role, createdAt],
      type: conn.QueryTypes.INSERT,
    })
    .then(function (result, err) {
      if (err) return callback(err, null);
      else return callback(null, result);
    });
};

module.exports = {
  checkCustomer,
  insertCustomer,
};
