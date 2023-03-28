/** save user Artwork **/
const moment = require('moment');
const conn = require('../dbConnection');
const mysql = require('mysql');
const mysql2Client = require('../Database/client');
const { select, insert, update, remove } = require('../Database/queries');

const getCustomerID = (getCustomerIdData, callback) => {
  const customerId = getCustomerIdData.customerId;
  conn
    .query(select.customer.getCustomerID, {
      replacements: [customerId],
      type: conn.QueryTypes.SELECT,
    })
    .then(function (result, err) {
      if (err || result == null) return callback(err, null);
      else return callback(null, result);
    });
};
/** post customer  Artwork **/
const insertCustomerArtWork = async (req, callback) => {
  const date = moment().format('YYYY-MM-DD HH:mm:ss');
  const artworkUrl = req.artworkUrl;
  const thumbnailUrl = req.thumbnailUrl;
  const artworkName = req.artworkName;
  const customerId = req.customerId;
  const customerTypeId = req.customerTypeId;
  const status = req.status;
  const artworkType = req.artworkType;
  const artworkColors = req.artworkColors;
  await mysql2Client
    .dbQuery(insert.artwork.insertCustomerArtWork, {
      replacements: [
        artworkUrl,
        thumbnailUrl,
        artworkName,
        customerId,
        customerTypeId,
        status,
        date,
        artworkType,
        artworkColors,
      ],
      type: conn.QueryTypes.INSERT,
    })
    .then(function (result, err) {
      if (err || result == null) return callback(err, null);
      else return callback(null, result);
    });
};

/** update customer  Artwork **/
const updateCustomerArtWork = async (req, callback) => {
  const artworkName = req.artworkName;
  const customerId = req.customerId;
  const customerTypeId = customerId == 1 ? 1 : 3;
  const artworkType = req.artworkType;
  const artworkColors = req.artworkColors;
  const artworkId = req.artworkId;
  await mysql2Client
    .dbQuery(update.artwork.updateCustomerArtWork, {
      replacements: [
        artworkName,
        customerId,
        customerTypeId,
        artworkType,
        artworkColors,
        artworkId,
      ],
      type: conn.QueryTypes.UPDATE,
    })
    .then(function (result, err) {
      if (err || result == null) return callback(err, null);
      else return callback(null, result);
    });
};

/** get customer  Artwork **/
const getCustomerArtWork = async (req, callback) => {
  const customerId = req.customer_id;
  const query = req.query || null;
  let totalCount = '';
  let limit = 8;
  let offset = 0;
  let startNum = parseInt(req.page);
  if (startNum == '1') {
    offset = 0;
    limit = 7;
  } else {
    offset = (startNum - 1) * 8 - 1;
  }
  let queryTotal = select.artwork.getCustomerArtWork;
  let selectQuery = select.artwork.getCustomerAllArtWork;
  if (query != null && query != '') {
    queryTotal += ` AND artwork_name LIKE "${query}%" `;
    selectQuery += ` AND a.artwork_name LIKE "${query}%" `;
  }
  await mysql2Client
    .dbQuery(queryTotal, {
      replacements: [customerId],
      type: conn.QueryTypes.SELECT,
    })
    .then(async function (rows, err) {
      if (err) {
        return callback(err, null);
      } else {
        totalCount = rows[0].TotalCount;
        let sort = 'a.id DESC';
        switch (req.sortBy) {
          case 'created-desc':
            sort = 'a.created_at DESC';
            break;
          case 'created-asc':
            sort = 'a.created_at ASC';
            break;
          case 'updated-desc':
            sort = 'a.updated_at DESC';
            break;
          case 'updated-asc':
            sort = 'a.updated_at ASC';
            break;
          default:
            sort = 'a.id DESC';
            break;
        }
        selectQuery += ` ORDER BY ${sort} LIMIT ? OFFSET ?`;
        await mysql2Client
          .dbQuery(selectQuery, {
            replacements: [customerId, limit, offset],
            type: conn.QueryTypes.SELECT,
          })
          .then(function (result, err) {
            if (err || result == null) {
              err = {
                message: 'error',
                body: {
                  error: 'Failed to get the artwork',
                },
              };
              return callback(err, null);
            } else {
              let totalPages = (totalCount + 1) / limit;
              let value = totalPages % 1;
              if (value != '0') {
                totalPages = parseInt(totalPages);
                totalPages = totalPages + 1;
              }
              result = {
                message: 'success',
                body: {
                  currentPage: startNum,
                  totalPages: totalPages,
                  totalArtwork: totalCount,
                  artwork: result,
                },
              };
              return callback(null, result);
            }
          });
      }
    });
};

/** get public  Artwork **/
const getPublicArtWork = async (req, callback) => {
  const query = req.query;
  let totalCount = '';
  let limit = 8;
  let offset = 0;
  if (!req.page) {
    req.page = 1;
  }
  let startNum = parseInt(req.page);
  offset = (startNum - 1) * limit;
  let queryTotal = select.artwork.getPublicArtWork;
  let selectQuery = select.artwork.getPublicAllArtWork;
  if (query != null && query != '') {
    queryTotal += ` AND artwork_name LIKE "${query}%" `;
    selectQuery += ` AND artwork_name LIKE "${query}%" `;
  }
  await mysql2Client
    .dbQuery(queryTotal, { type: conn.QueryTypes.SELECT })
    .then(async function (rows, err) {
      if (err) {
        return callback(err, null);
      } else {
        totalCount = rows[0].TotalCount;
        let sort = 'id DESC';
        switch (req.sortBy) {
          case 'created-desc':
            sort = 'created_at DESC';
            break;
          case 'created-asc':
            sort = 'created_at ASC';
            break;
          case 'updated-desc':
            sort = 'updated_at DESC';
            break;
          case 'updated-asc':
            sort = 'updated_at ASC';
            break;
          default:
            sort = 'id DESC';
            break;
        }
        selectQuery += ` ORDER BY ${sort} LIMIT ? OFFSET ?`;
        await mysql2Client
          .dbQuery(selectQuery, {
            replacements: [limit, offset],
            type: conn.QueryTypes.SELECT,
          })
          .then(function (result, err) {
            if (err || result == null) {
              err = {
                message: 'error',
                body: {
                  error: 'Failed to get the artwork',
                },
              };
              return callback(err, null);
            } else {
              totalPages = totalCount / limit;
              value = totalPages % 1;
              if (value != '0') {
                totalPages = parseInt(totalPages);
                totalPages = totalPages + 1;
              }
              result = {
                message: 'success',
                body: {
                  currentPage: startNum,
                  totalPages: totalPages,
                  totalPrtwork: totalCount,
                  artwork: result,
                },
              };
              return callback(null, result);
            }
          });
      }
    });
};

// get artworks by ids
const getArtworksByIds = async (ids, callback) => {
  if (ids) {
    let getArtworksByIdsQuery = select.artwork.getArtworksByIds + `('${ids}')`;
    await mysql2Client
      .dbQuery(getArtworksByIdsQuery, {
        type: conn.QueryTypes.SELECT,
      })
      .then(function (result, err) {
        if (err) callback(err, null);
        return callback(null, result);
      });
  } else {
    return callback(null, null);
  }
};
// get artworks by ids
const getArtworksById = async (req, callback) => {
  if (req) {
    const artId = req.id;
    await mysql2Client
      .dbQuery(select.artwork.getArtworksById, {
        replacements: [artId],
        type: conn.QueryTypes.SELECT,
      })
      .then(function (result, err) {
        if (err) return callback(err, null);
        else return callback(null, result);
      });
  } else {
    return callback(null, null);
  }
};

/** remove customer  Artwork **/
const deleteCustomerArtWork = async (req, callback) => {
  const date = moment().format('YYYY-MM-DD HH:mm:ss');
  const artId = req.id;
  await mysql2Client
    .dbQuery(update.artwork.deleteCustomerArtWork, {
      replacements: [date, artId],
      type: conn.QueryTypes.UPDATE,
    })
    .then(function (result, err) {
      if (err || result == null) return callback(err, null);
      else return callback(null, result);
    });
};

/** get admin  Artwork **/
const getAdminArtWork = async (req, callback) => {
  let totalCount = '';
  let limit = 10;
  let offset = 0;
  if (!req.page) {
    req.page = 1;
  }
  let startNum = parseInt(req.page);
  offset = (startNum - 1) * limit;
  await mysql2Client
    .dbQuery(select.artwork.getAdminArtWorkCount, {
      type: conn.QueryTypes.SELECT,
    })
    .then(async function (rows, err) {
      if (err) {
        callback(err, null);
      } else {
        totalCount = rows[0].TotalCount;
        await mysql2Client
          .dbQuery(select.artwork.getAdminArtWork, {
            replacements: [limit, offset],
            type: conn.QueryTypes.SELECT,
          })
          .then(function (result, err) {
            if (err || result == null) {
              err = {
                message: 'error',
                body: {
                  error: 'Failed to get the artwork',
                },
              };
              return callback(err, null);
            } else {
              let totalPages = totalCount / limit;
              let value = totalPages % 1;
              if (value != '0') {
                totalPages = parseInt(totalPages);
                totalPages = totalPages + 1;
              }
              let result = {
                message: 'success',
                body: {
                  currentPage: startNum,
                  totalPages: totalPages,
                  totalArtwork: totalCount,
                  artwork: result,
                },
              };
              return callback(null, result);
            }
          });
      }
    });
};

const checkImageAssociationStatus = async (req, callback) => {
  const artId = req.id;
  await mysql2Client
    .dbQuery(select.artwork.checkImageAssociationStatus, {
      replacements: [artId],
      type: conn.QueryTypes.SELECT,
    })
    .then(function (result, err) {
      if (err || result == null) return callback(err, null);
      else return callback(null, result);
    });
};
/** get all  Artwork **/
const getAllArtWork = async (req, callback) => {
  const query = req.query || null;
  let totalCount = '';
  let limit = 12;
  let offset = 0;
  let queryTotal = '';
  let queryTotalArtwork = '';
  let startNum = parseInt(req.page);
  if (startNum == '1') {
    offset = 0;
    limit = 12;
  } else {
    offset = (startNum - 1) * 12 - 1;
  }
  let customerID = req.customer_id || null;
  switch (customerID) {
    case 'all':
    case null:
      queryTotal = select.artwork.getAllArtWorkCount;
      queryTotalArtwork = select.artwork.getAllArtWork;
      break;
    case 'lago':
      queryTotal = select.artwork.getAllArtWorkLagoCount;
      queryTotalArtwork = select.artwork.getAllArtWorkLago;
      break;
    default:
      queryTotal = select.artwork.getAllArtWorkCustomerCount;
      queryTotalArtwork =
        select.artwork.getAllArtWorkCustomer +
        `AND a.customer_id ='${customerID}'`;
      break;
  }
  if (req.query != null && req.query != '') {
    queryTotal += ` AND artwork_name LIKE "${query}%" `;
    queryTotalArtwork += ` AND a.artwork_name LIKE "${query}%" `;
  }
  await mysql2Client
    .dbQuery(queryTotal, {
      replacements: [customerID],
      type: conn.QueryTypes.SELECT,
    })
    .then(async function (rows, err) {
      if (err) {
        return callback(err, null);
      } else {
        totalCount = rows[0].TotalCount;
        let sort = 'a.id DESC';
        switch (req.sortBy) {
          case 'created-desc':
            sort = 'a.created_at DESC';
            break;
          case 'created-asc':
            sort = 'a.created_at ASC';
            break;
          case 'updated-desc':
            sort = 'a.updated_at DESC';
            break;
          case 'updated-asc':
            sort = 'a.updated_at ASC';
            break;
          default:
            sort = 'a.id DESC';
            break;
        }
        queryTotalArtwork += ` ORDER BY ${sort} LIMIT ? OFFSET ? `;
        await mysql2Client
          .dbQuery(queryTotalArtwork, {
            replacements: [limit, offset],
            type: conn.QueryTypes.SELECT,
          })
          .then(function (result, err) {
            if (err || result == null) {
              err = {
                message: 'error',
                body: {
                  error: 'Failed to get the artwork',
                },
              };
              return callback(err, null);
            } else {
              let totalPages = (totalCount + 1) / limit;
              let value = totalPages % 1;
              if (value != '0') {
                totalPages = parseInt(totalPages);
                totalPages = totalPages + 1;
              }
              result = {
                message: 'success',
                body: {
                  currentPage: startNum,
                  totalPages: totalPages,
                  totalArtwork: totalCount,
                  artwork: result,
                },
              };
              return callback(null, result);
            }
          });
      }
    });
};

module.exports = {
  insertCustomerArtWork,
  updateCustomerArtWork,
  getCustomerArtWork,
  getCustomerID,
  getPublicArtWork,
  getArtworksByIds,
  deleteCustomerArtWork,
  getAdminArtWork,
  checkImageAssociationStatus,
  getAllArtWork,
  getArtworksById,
};
