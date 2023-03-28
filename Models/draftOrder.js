const conn = require('../dbConnection');
const moment = require('moment');
const mysql = require('mysql');
const momentTimezone = require('moment-timezone');
const mysql2Client = require('../Database/client');
const { select, insert, update, remove } = require('../Database/queries');
const ROLES = {
  admin: 'admin',
  customer: 'customer',
  salesRep: 'salesRep',
};

// insert custom product
const insertCustomProduct = (data, callback) => {
  const shCustomerId = data.shCutomerId;
  conn
    .query(select.customer.selectCustomer, {
      replacements: [shCustomerId],
      type: conn.QueryTypes.SELECT,
    })
    .then(async function (result, err) {
      if (err) {
        return callback(err, null);
      } else {
        let customProducts = {};
        let customerId = result[0].id;
        let front = '';
        let back = '';
        let sleeve = '';
        let createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
        let length = 0;
        for (let productId of Object.keys(data.customProducts)) {
          let values = [];
          if (data.customProducts[productId].front !== undefined) {
            front = data.customProducts[productId].front;
          }
          if (data.customProducts[productId].back !== undefined) {
            back = data.customProducts[productId].back;
          }
          if (data.customProducts[productId].sleeve !== undefined) {
            sleeve = data.customProducts[productId].sleeve;
          }
          let variants = JSON.stringify(data.variants[productId]);
          values = [
            customerId,
            front,
            back,
            sleeve,
            productId,
            variants,
            createdAt,
          ];
          if (values.length > 0) {
            const result = await conn.query(
              insert.customProductRendering.insertCustomProductRender,
              {
                replacements: [
                  customerId,
                  front,
                  back,
                  sleeve,
                  productId,
                  variants,
                  createdAt,
                ],
                type: conn.QueryTypes.INSERT,
              },
            );
            customProducts[data.productIds[length]] = {
              custom_product_id: result[0],
            };
            length++;
            if (length == Object.keys(data.customProducts).length) {
              return callback(null, customProducts);
            }
          }
        }
      }
    });
};

// insert image association data
const insertImageAssociation = async (data, callback) => {
  const imageAssociation = data.associationData;
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
  let values = [];
  let n = 0;
  let length = 0;
  let result = null;
  for (let key of Object.keys(imageAssociation)) {
    let artworks = imageAssociation[key].arts;
    for (let i = 0; i < artworks.length; i++) {
      values[n] = [
        artworks[i],
        imageAssociation[key].custom_product_id,
        createdAt,
      ];
      n++;
      result = await conn.query(
        insert.customProductRendering.insertImageAssociation,
        {
          replacements: [
            artworks[i],
            imageAssociation[key].custom_product_id,
            createdAt,
          ],
          type: conn.QueryTypes.INSERT,
        },
      );
    }
    length++;
    if (length == Object.keys(imageAssociation).length) {
      return callback(null, result);
    }
  }
};

// insert order
const insertOrder = (data, callback) => {
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
  let customProductIds = [];
  for (let key of Object.keys(data.customProductIds)) {
    customProductIds.push(data.customProductIds[key].custom_product_id);
  }
  conn
    .query(insert.order.insertOrder, {
      replacements: [
        data.shOrderId,
        JSON.stringify(customProductIds),
        createdAt,
      ],
      type: conn.QueryTypes.INSERT,
    })
    .then(function (result, err) {
      if (err) return callback(err, null);
      else return callback(null, result);
    });
};

// update order
const updateOrder = (data, callback) => {
  const shOrderId = data.shOrderId;
  conn
    .query(select.order.customProduct, {
      replacements: [shOrderId],
      type: conn.QueryTypes.SELECT,
    })
    .then(function (result, err) {
      if (err) {
        return callback(err, null);
      } else if (result) {
        let oldCustomProductIds = JSON.parse(result[0].custom_product_id);
        let customProductIds = [];
        for (let key of Object.keys(data.customProductIds)) {
          customProductIds.push(data.customProductIds[key].custom_product_id);
        }
        conn
          .query(update.order.customProduct, {
            replacements: [JSON.stringify(customProductIds), shOrderId],
            type: conn.QueryTypes.UPDATE,
          })
          .then(async function (result, err) {
            if (err) {
              return callback(err, null);
            } else if (result) {
              const oldIds = oldCustomProductIds.toString();
              await conn.query(update.order.customProductSql, {
                replacements: [oldIds],
                type: conn.QueryTypes.UPDATE,
              });
              await conn.query(update.order.imgAssocSql, {
                replacements: [oldIds],
                type: conn.QueryTypes.UPDATE,
              });
              return callback(null, result);
            }
          });
      }
    });
};

// get customized products
const getCustomizedProductsByOrder = async (orderId) => {
  const customProductResult = await conn.query(
    select.order.getCustomizedProductsByOrder,
    { replacements: [orderId], type: conn.QueryTypes.SELECT },
  );
  const customProductIds = JSON.parse(customProductResult[0].custom_product_id);
  try {
    let sql =
      select.order.customProductRendering +
      ` AND CPR.id IN ('${customProductIds.join("','")}')`;
    let result = await conn.query(sql, { type: conn.QueryTypes.SELECT });
    return result;
  } catch (e) {
    return e;
  }
};

// insert order comments
const insertOrderComments = (data, callback) => {
  const shOrderId = data.order_id;
  let response = {
    order_id: data.order_id,
    comment: data.comment,
    sender: data.from,
    sender_type: '',
    receiver: data.to,
    receiver_type: '',
  };
  conn
    .query(select.order.orderId, {
      replacements: [shOrderId],
      type: conn.QueryTypes.SELECT,
    })
    .then(function (result, err) {
      if (err) {
        return callback(err, null);
      } else if (result) {
        let orderId = result[0].id;
        let senderId = null;
        let senderType = null;
        let receiverId = null;
        let receiverType = null;
        if (data.from == ROLES.admin) {
          senderId = 1;
          senderType = 1;
          response['sender'] = ROLES.admin;
          response['sender_type'] = ROLES.admin;
        }
        if (data.to == ROLES.admin) {
          receiverType = 1;
          response['receiver'] = ROLES.admin;
          response['receiver_type'] = ROLES.admin;
        }
        let createdAt = momentTimezone()
          .tz('America/Los_Angeles')
          .format('YYYY-MM-DD HH:mm:ss');
        let receiverSql = '';
        let commentSql = '';
        if (data.from != ROLES.admin) {
          let fromCustomer = null;
          if (data.from == ROLES.customer) {
            fromCustomer = data.to;
          } else if (data.from == ROLES.salesRep) {
            fromCustomer = data.sales_rep;
          }
          conn
            .query(select.customer.getCustomerForCommet, {
              replacements: [fromCustomer],
              type: conn.QueryTypes.SELECT,
            })
            .then(function (result, err) {
              if (result && result != '') {
                senderId = result[0].id;
                senderType = result[0].customer_type_id;
                response['sender_type'] = result[0].type;
                if (data.from == ROLES.customer) {
                  conn
                    .query(select.customer.getCustomerForCommet, {
                      replacements: [data.to],
                      type: conn.QueryTypes.SELECT,
                    })
                    .then(function (result, err) {
                      if (result) {
                        receiverId = result[0].id;
                        receiverType = result[0].customer_type_id;
                        response['receiver_type'] = result[0].type;
                        let comment_update = mysql.escape(data.comment);
                        conn
                          .query(insert.order.insertOrderComment, {
                            replacements: [
                              orderId,
                              senderId,
                              senderType,
                              comment_update,
                              receiverId,
                              receiverType,
                              createdAt,
                            ],
                            type: conn.QueryTypes.INSERT,
                          })
                          .then(function (result, err) {
                            if (err) return callback(err, null);
                            conn
                              .query(select.order.orderCommentDetails, {
                                replacements: [shOrderId],
                                type: conn.QueryTypes.SELECT,
                              })
                              .then(function (result, err) {
                                if (err) return callback(err, null);
                                else return callback(null, result);
                              });
                          });
                      }
                    });
                } else {
                  conn
                    .query(select.customer.getCustomerForCommet, {
                      replacements: [data.to],
                      type: conn.QueryTypes.SELECT,
                    })
                    .then(function (result, err) {
                      if (result) {
                        receiverId = result[0].id;
                        receiverType = result[0].customer_type_id;
                        response['receiver_type'] = result[0].type;
                        let comment_update = mysql.escape(data.comment);
                        conn
                          .query(insert.order.insertOrderComment, {
                            replacements: [
                              orderId,
                              senderId,
                              senderType,
                              comment_update,
                              receiverId,
                              receiverType,
                              createdAt,
                            ],
                            type: conn.QueryTypes.INSERT,
                          })
                          .then(function (result, err) {
                            if (err) callback(err, null);
                            conn
                              .query(select.order.orderCommentDetails, {
                                replacements: [shOrderId],
                                type: conn.QueryTypes.SELECT,
                              })
                              .then(function (result, err) {
                                if (err) callback(err, null);
                                callback(null, result);
                              });
                          });
                      }
                    });
                }
              }
            });
        } else if (data.from == ROLES.admin) {
          conn
            .query(select.customer.getCustomerForCommet, {
              replacements: [data.to],
              type: conn.QueryTypes.SELECT,
            })
            .then(function (result, err) {
              if (result) receiverId = result[0].id;
              receiverType = result[0].customer_type_id;
              response['receiver_type'] = result[0].type;
              let comment_update = mysql.escape(data.comment);
              conn
                .query(insert.order.insertOrderComment, {
                  replacements: [
                    orderId,
                    senderId,
                    senderType,
                    comment_update,
                    receiverId,
                    receiverType,
                    createdAt,
                  ],
                  type: conn.QueryTypes.INSERT,
                })
                .then(function (result, err) {
                  if (err) callback(err, null);
                  conn
                    .query(select.order.orderCommentDetails, {
                      replacements: [shOrderId],
                      type: conn.QueryTypes.SELECT,
                    })
                    .then(function (result, err) {
                      if (err) callback(err, null);
                      callback(null, result);
                    });
                });
            });
        }
      }
    });
};

// get Draft order comments

const getOrderComments = (data, callback) => {
  const orderId = data.orderId;
  conn
    .query(select.comments.getOrderComments, {
      replacements: [orderId],
      type: conn.QueryTypes.SELECT,
    })
    .then(function (result, err) {
      return callback(null, result);
    });
};

module.exports = {
  insertCustomProduct,
  insertImageAssociation,
  insertOrder,
  updateOrder,
  insertOrderComments,
  getOrderComments,
  getCustomizedProductsByOrder,
};
