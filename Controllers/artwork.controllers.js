require('dotenv').config();
const axios = require('axios');
const {
  validateArtworkInputs,
  validateArtworkImage,
} = require('../validators/artworkValidator');
const { fileUpload } = require('../Utils/fileUpload');
const artWorkModel = require('../Models/artwork');
const Auth = require('../Models/authorization');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const request = require('request');
const csv = require('csv-parser');
const multer = require('multer');
const sharp = require('sharp');
const momentTimezone = require('moment-timezone');
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './images');
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});
const { shopify } = require('../Utils/shopifyConnect');
const loggerTrack = require('../Utils/log');
const ShopifyCustomerRest = require('../ShopifyRest/customer');

// Upload customer artworks
const postCustomerArtWork = (req, res) => {
  const logger = loggerTrack('artwork/createArtwork');
  logger.info('------------start--------------');
  let customerId = '';
  const { errors, isValid } = validateArtworkInputs(req);
  if (!isValid) {
    logger.debug(errors);
    return res.status(600).json({
      message: 'error',
      body: {
        error: errors,
      },
    });
  }
  const { status, message } = validateArtworkImage(req);
  if (status === false) {
    logger.debug(message);
    res.status(600).send({
      message: 'error',
      body: { error: message },
    });
  } else {
    let getCustomerIdData = { customerId: req.body.customerId };
    artWorkModel.getCustomerID(getCustomerIdData, function (err, result) {
      if (err) {
        logger.debug(`Failed to upload the artwork: ${err}`);
        res.status(600).send({
          message: 'error',
          body: { error: 'Failed to upload the artwork' },
        });
      } else if (result != '') {
        customerId = result[0].id;
        let imageFile = req.files['artUrl'];
        let filename = req.files['artUrl']['name'];
        filename = filename.replace(/\s/g, '');
        imageData = {
          imageFile: imageFile,
          filename: filename,
          subFolder: 'artworks',
          customerID: getCustomerIdData.customerId,
        };
        const { status, fileName, message, thumbnailImageName } =
          fileUpload(imageData);
        if (status === false) {
          logger.debug(message);
          res.send({
            message: 'error',
            body: { error: message },
          });
        }
        let artworkUrl = req.headers.host + '/images/artworks/' + fileName;
        let thumbnailUrl =
          req.headers.host + '/images/artworks/' + thumbnailImageName;
        let artwork = null;
        if (getCustomerIdData.customerId == 1) {
          artwork = {
            artworkUrl: 'https://' + artworkUrl,
            thumbnailUrl: 'https://' + thumbnailUrl,
            artworkName: req.body.artworkName,
            artworkType: req.body.artworkType,
            artworkColors: req.body.artworkColors,
            customerTypeId: '1',
            customerId: getCustomerIdData.customerId,
            status: '1',
          };
        } else {
          artwork = {
            artworkUrl: 'https://' + artworkUrl,
            thumbnailUrl: 'https://' + thumbnailUrl,
            artworkName: req.body.artworkName,
            artworkType: req.body.artworkType,
            artworkColors: req.body.artworkColors,
            customerTypeId: '3',
            customerId: customerId,
            status: '1',
          };
        }
        req = artwork;
        artWorkModel.insertCustomerArtWork(req, function (err, result) {
          if (err) {
            logger.debug(
              'error',
              `Failed to upload the artwork :- ${JSON.stringify(err)}`,
            );
            res.status(600).send({
              message: 'error',
              body: { error: 'Failed to upload the artwork' },
            });
          } else {
            result = {
              message: 'success',
              body: {
                created: true,
                id: result['insertId'],
                name: req.artworkName,
                type: req.artworkType,
                url: req.artworkUrl,
              },
            };
            logger.info(
              `Successfully uploaded artwork :- ${JSON.stringify(result)}`,
            );
            logger.info('-------------end-------------');
            res.status(200).send(result);
          }
        });
      } else {
        logger.debug(`Customer is not registered :- ${req.body.customerId}`);
        res.send({
          message: 'error',
          body: { error: 'Customer is not registered' },
        });
      }
    });
  }
};
// Update customer artworks
const updateCustomerArtWork = (req, res) => {
  const logger = loggerTrack('artwork/createArtwork');
  logger.info('------------start--------------');
  let customerId = '';
  const { errors, isValid } = validateArtworkInputs(req);
  if (!isValid) {
    logger.debug(errors);
    return res.status(600).json({
      message: 'error',
      body: {
        error: errors,
      },
    });
  }
  let customerIDName = req.body.customerId == 'lago' ? 1 : req.body.customerId;
  let getCustomerIdData = { customerId: customerIDName };
  artWorkModel.getCustomerID(getCustomerIdData, function (err, result) {
    if (err) {
      logger.debug(`Failed to upload the artwork: ${err}`);
      res.status(600).send({
        message: 'error',
        body: { error: 'Failed to upload the artwork' },
      });
    } else if (result && result != '') {
      customerId = result[0].id;
      const artwork = {
        artworkId: req.params.id,
        artworkName: req.body.artworkName,
        artworkType: req.body.artworkType,
        artworkColors: req.body.artworkColors,
        customerTypeId: '3',
        customerId: customerId,
        status: '1',
      };
      req = artwork;
      artWorkModel.updateCustomerArtWork(req, function (err, result) {
        if (err) {
          logger.debug(
            'error',
            `Failed to upload the artwork :- ${JSON.stringify(err)}`,
          );
          res.status(600).send({
            message: 'error',
            body: { error: 'Failed to upload the artwork' },
          });
        } else {
          result = {
            message: 'success',
            body: {
              created: true,
              id: result['insertId'],
              name: req.artworkName,
              type: req.artworkType,
              url: req.artworkUrl,
            },
          };
          logger.info(
            `Successfully uploaded artwork :- ${JSON.stringify(result)}`,
          );
          logger.info('-------------end-------------');
          res.status(200).send(result);
        }
      });
    } else {
      logger.debug(`Customer is not registered :- ${req.body.customerId}`);
      res.send({
        message: 'error',
        body: { error: 'Customer is not registered' },
      });
    }
  });
};
// get customer  Artwork
const getCustomerArtWork = (req, res) => {
  const logger = loggerTrack('artwork/getCustomerArtwork');
  logger.info('------------start--------------');
  if (!req.query['customer-id']) {
    logger.debug('Missing required parameter customer_id');
    res.status(600).send({
      message: 'error',
      body: { error: 'Missing required parameter customer_id' },
    });
  }
  let customerId = '';
  let getCustomerIdData = { customerId: req.query['customer-id'] };
  artWorkModel.getCustomerID(getCustomerIdData, async function (err, result) {
    if (err) {
      logger.debug(`Failed to get the artwork :- ${JSON.stringify(err)}`);
      res.status(600).send({
        message: 'error',
        body: { error: 'Failed to get the artwork' },
      });
    } else if (result && result != '') {
      customerId = result[0].id;
      if (!req.query.page) {
        req.query.page = 1;
      }
      if (!req.query['sort-by']) {
        req.query['sort-by'] = '';
      }
      const artwork = {
        page: req.query.page,
        customer_id: result[0].id,
        query: req.query.query || null,
        sortBy: req.query['sort-by'],
        customerShopify_id: req.query['customer-id'],
      };
      req = artwork;
      artWorkModel.getCustomerArtWork(req, function (err, result, totalCount) {
        if (err) {
          logger.debug(`Failed to get the artwork :- ${JSON.stringify(err)}`);
          res.status(600).send(err);
        } else {
          logger.info(
            `Successfully fetched the artworks :- ${JSON.stringify(result)}`,
          );
          logger.info('-------------end-------------');
          res.status(200).send(result);
        }
      });
    } else {
      let shCustomer = await ShopifyCustomerRest.getShopifyCustomerById(
        req.query['customer-id'],
      );

      if (shCustomer) {
        let insertData = {
          shopifyCustomerId: req.query['customer-id'],
          role: 3,
        };
        Auth.insertCustomer(insertData, (err, result) => {
          if (err) {
            logMessege = Array('error', 'Failed to varify the user');
            logger.debug(logMessege);
            return res.status(600).json({
              message: 'error',
              body: {
                error: 'Failed to varify the user',
              },
            });
          } else if (result && result != '') {
            res.status(200).send({
              message: 'success',
              body: {
                currentPage: 1,
                totalPages: 1,
                totalArtwork: 0,
                artwork: {},
              },
            });
          }
        });
      } else {
        logger.debug(
          `Customer is not registered :- ${req.query['customer-id']}`,
        );
        res.status(600).send({
          message: 'error',
          body: { error: 'Customer is not registered' },
        });
      }
    }
  });
};
// get All  Artwork
const getAllArtWorks = (req, res) => {
  const logger = loggerTrack('artwork/getCustomerArtwork');
  logger.info('------------start--------------');
  if (!req.query['customer-id']) {
    logger.debug('Missing required parameter customer_id');
    res.status(600).send({
      message: 'error',
      body: { error: 'Missing required parameter customer_id' },
    });
  } else if (req.query['customer-id'] == 'all') {
    if (!req.query.page) {
      req.query.page = 1;
    }
    if (!req.query['sort-by']) {
      req.query['sort-by'] = '';
    }
    const artwork = {
      page: req.query.page,
      customer_id: 'all',
      query: req.query.query || null,
      sortBy: req.query['sort-by'],
      customerShopify_id: req.query['customer-id'],
    };
    req = artwork;
    artWorkModel.getAllArtWork(req, function (err, result, totalCount) {
      if (err) {
        logger.debug(`Failed to get the artwork :- ${JSON.stringify(err)}`);
        res.status(600).send(err);
      } else {
        logger.info(
          `Successfully fetched the artworks :- ${JSON.stringify(result)}`,
        );
        logger.info('-------------end-------------');
        res.status(200).send(result);
      }
    });
  } else if (req.query['customer-id'] == 'lago') {
    if (!req.query.page) {
      req.query.page = 1;
    }
    if (!req.query['sort-by']) {
      req.query['sort-by'] = '';
    }
    const artwork = {
      page: req.query.page,
      customer_id: 'lago',
      query: req.query.query || null,
      sortBy: req.query['sort-by'],
      customerShopify_id: req.query['customer-id'],
    };
    req = artwork;
    artWorkModel.getAllArtWork(req, function (err, result, totalCount) {
      if (err) {
        logger.debug(`Failed to get the artwork :- ${JSON.stringify(err)}`);
        res.status(600).send(err);
      } else {
        logger.info(
          `Successfully fetched the artworks :- ${JSON.stringify(result)}`,
        );
        logger.info('-------------end-------------');
        res.status(200).send(result);
      }
    });
  } else {
    let customerId = '';
    let getCustomerIdData = { customerId: req.query['customer-id'] };
    artWorkModel.getCustomerID(getCustomerIdData, async function (err, result) {
      if (err) {
        logger.debug(`Failed to get the artwork :- ${JSON.stringify(err)}`);
        res.status(600).send({
          message: 'error',
          body: { error: 'Failed to get the artwork' },
        });
      } else if (result && result != '') {
        customerId = result[0].id;
        if (!req.query.page) {
          req.query.page = 1;
        }
        if (!req.query['sort-by']) {
          req.query['sort-by'] = '';
        }
        const artwork = {
          page: req.query.page,
          customer_id: result[0].id,
          query: req.query.query || null,
          sortBy: req.query['sort-by'],
          customerShopify_id: req.query['customer-id'],
        };
        req = artwork;
        artWorkModel.getAllArtWork(req, function (err, result, totalCount) {
          if (err) {
            logger.debug(`Failed to get the artwork :- ${JSON.stringify(err)}`);
            res.status(600).send(err);
          } else {
            logger.info(
              `Successfully fetched the artworks :- ${JSON.stringify(result)}`,
            );
            logger.info('-------------end-------------');
            res.status(200).send(result);
          }
        });
      } else {
        let shCustomer = await ShopifyCustomerRest.getShopifyCustomerById(
          req.query['customer-id'],
        );

        if (shCustomer) {
          let insertData = {
            shopifyCustomerId: req.query['customer-id'],
            role: 3,
          };
          Auth.insertCustomer(insertData, (err, result) => {
            if (err) {
              logMessege = Array('error', 'Failed to varify the user');
              logger.debug(logMessege);
              return res.status(600).json({
                message: 'error',
                body: {
                  error: 'Failed to varify the user',
                },
              });
            } else if (result && result != '') {
              res.status(200).send({
                message: 'success',
                body: {
                  currentPage: 1,
                  totalPages: 1,
                  totalArtwork: 0,
                  artwork: {},
                },
              });
            }
          });
        } else {
          logger.debug(
            `Customer is not registered :- ${req.query['customer-id']}`,
          );
          res.status(600).send({
            message: 'error',
            body: { error: 'Customer is not registered' },
          });
        }
      }
    });
  }
};
// get public  Artwork
const getPublicArtWork = (req, res) => {
  const logger = loggerTrack('artwork/getPublicArtwork');
  logger.info('------------start--------------');
  if (!req.query.page) {
    req.query.page = 1;
  }
  if (!req.query['sort-by']) {
    req.query['sort-by'] = '';
  }
  const getAllPublicArtWork = {
    page: req.query.page,
    query: req.query.query || null,
    sortBy: req.query['sort-by'],
  };
  req = getAllPublicArtWork;
  artWorkModel.getPublicArtWork(req, function (err, result, totalCount) {
    if (err) {
      logger.debug(
        `Failed to fetched the public artworks :- ${JSON.stringify(err)}`,
      );
      res.status(600).send(err);
    } else {
      logger.info(
        `Successfully fetched the public artworks :- ${JSON.stringify(result)}`,
      );
      res.status(200).send(result);
    }
  });
};

// Image encode
const imageEncode = async (req, res) => {
  if (req.body.image_url) {
    const url = req.body.image_url;
    const image = await axios.get(url, { responseType: 'arraybuffer' });
    const raw = Buffer.from(image.data).toString('base64');
    const encodedUrl =
      'data:' + image.headers['content-type'] + ';base64,' + raw;
    res.status(200).send({
      message: 'success',
      body: {
        encodedUrl: encodedUrl,
      },
    });
  }
};

// get remove customer artwork
const removeCustomerArtWork = (req, res) => {
  const logger = loggerTrack('artwork/removeCustomerArtWork');
  logger.info('------------start--------------');
  if (req.body.id) {
    const artworkId = req.body.id;
    const artwork = {
      id: artworkId,
    };
    artWorkModel.checkImageAssociationStatus(artwork, function (err, result) {
      if (err) {
        logger.debug(
          'error',
          `Failed to check the status :- ${JSON.stringify(err)}`,
        );
        res.status(600).send({
          message: 'error',
          body: { error: 'Failed to check the status' },
        });
      } else {
        artWorkModel.deleteCustomerArtWork(artwork, function (err, result) {
          if (err) {
            logger.debug(
              'error',
              `Failed to remove the artwork :- ${JSON.stringify(err)}`,
            );
            res.status(600).send({
              message: 'error',
              body: { error: 'Failed to remove the artwork' },
            });
          } else {
            result = {
              message: 'success',
              body: {
                removed: true,
              },
            };
            logger.info(
              `Successfully removed artwork :- ${JSON.stringify(result)}`,
            );
            logger.info('-------------end-------------');
            res.status(200).send(result);
          }
        });
      }
    });
  } else {
    logger.debug(message);
    res.status(600).send({
      message: 'error',
      body: { error: message },
    });
  }
};

// get admin artwork
const getAdminArtWork = (req, res) => {
  const logger = loggerTrack('artwork/getAdminArtwork');
  logger.info('------------start--------------');
  if (!req.query.page) {
    req.query.page = 1;
  }
  const getAdminArtWork = {
    page: req.query.page,
  };
  req = getAdminArtWork;
  artWorkModel.getAdminArtWork(req, function (err, result, totalCount) {
    if (err) {
      logger.debug(
        `Failed to fetched the public artworks :- ${JSON.stringify(err)}`,
      );
      res.status(600).send(err);
    } else {
      logger.info(
        `Successfully fetched the public artworks :- ${JSON.stringify(result)}`,
      );
      res.status(200).send(result);
    }
  });
};
// get artwork by ID
const getArtworkById = (req, res) => {
  const logger = loggerTrack('artwork/getAdminArtwork');
  logger.info('------------start--------------');
  const getArtworkById = {
    id: req.params.id,
  };
  const token = req.header('access-token');
  let userRole = null;
  let customerId = null;
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    userRole = decoded.role;
    customerId = decoded.id;
  });
  req = getArtworkById;
  artWorkModel.getArtworksById(req, function (err, result, totalCount) {
    if (err) {
      logger.debug(
        `Failed to fetched the public artworks :- ${JSON.stringify(err)}`,
      );
      res.status(600).send(err);
    } else {
      if (userRole === 'customer' && customerId != result[0].sh_customer_id) {
        return res.status(401).send({
          status: 'error',
          body: {
            error: 'Access Denied!',
          },
        });
      }
      logger.info(
        `Successfully fetched the public artworks :- ${JSON.stringify(result)}`,
      );
      res.status(200).send(result);
    }
  });
};
const uploadArtwork = async (req, res) => {
  let count = 1;
  let imageURLArray = [];
  let imageFile = req.files['artworkCsv'];
  let filename = req.files['artworkCsv']['name'];
  filename = filename.replace(/\s/g, '');
  fileData = {
    imageFile: imageFile,
    filename: filename,
    subFolder: 'artworks',
  };
  let ext = fileData.filename.split('.').pop();
  let lastDotPosition = fileData.filename.lastIndexOf('.');
  let imageName = null;
  if (lastDotPosition === -1) {
    imageName = fileData.filename;
  } else {
    imageName = fileData.filename.substr(0, lastDotPosition);
  }
  imageName = imageName.replace(/[^a-zA-Z0-9 ]/g, '');
  if (imageName == '') {
    imageName = 'art_bulk_upload';
  }
  let createdAt = momentTimezone()
    .tz('America/Los_Angeles')
    .format('YYYY-MM-DD-HH:mm:ss');
  imageName = imageName + '-' + createdAt + '.' + ext;
  let uploadStatus = fileData.imageFile.mv(
    './images/' + fileData.subFolder + '/' + imageName,
  );
  let artworkUrl = req.headers.host + '/images/artworks/' + imageName;
  let result = {
    status: true,
    fileName: imageName,
    artworkUrl: artworkUrl,
    message: 'Successfully uploaded',
  };
  setTimeout(() => {
    fs.createReadStream('./images/artworks/' + imageName)
      .pipe(csv())
      .on('data', async (row) => {
        const list = [
          {
            name: 'lago_artwork_' + count + '_' + createdAt,
            photoUrl: row.Goog_Doc_URL.split('?')[0],
            thumbnailName:
              'lago_artwork_' + count + '_' + createdAt + '_400x200',
            numberOfColors: row.Number_of_ink_colours,
          },
        ];
        count = Number(count) + 1;
        async function main() {
          const download = ({
            fileName,
            name,
            url,
            thumbnailName,
            numberOfColors,
          }) =>
            new Promise((resolve, reject) => {
              request({ url: url, encoding: null }, (err, res, buf) => {
                if (err) {
                  reject(err);
                  return;
                }
                if (res.headers['content-type'].includes('text/html')) {
                  resolve(null);
                  return;
                }
                fs.writeFile(
                  './images/artworks/' + name,
                  buf,
                  {
                    flag: 'a',
                  },
                  (err) => {
                    if (err) reject(err);
                  },
                );
                sharp(buf)
                  .resize(393, 200)
                  .toFile(
                    './images/artworks/' + thumbnailName,
                    (err, resizeImage) => {
                      if (err) {
                        console.log(err);
                      }
                    },
                  );
                let artworkUrl = req.headers.host + '/images/artworks/' + name;
                let thumbnailUrl =
                  req.headers.host + '/images/artworks/' + thumbnailName;
                let artwork = {
                  artworkUrl: 'https://' + artworkUrl,
                  thumbnailUrl: 'https://' + thumbnailUrl,
                  artworkName: fileName,
                  artworkType: 'Lago_artwork',
                  artworkColors: numberOfColors,
                  customerTypeId: '1',
                  customerId: '1',
                  status: '1',
                };
                artWorkModel.insertCustomerArtWork(
                  artwork,
                  function (err, result) {
                    if (err) {
                      console.log(err);
                    } else {
                      result = {
                        message: 'success',
                        body: {
                          created: true,
                          id: result['insertId'],
                          name: artwork.artworkName,
                          type: artwork.artworkType,
                          url: artwork.artworkUrl,
                        },
                      };
                    }
                  },
                );
                resolve(buf);
              });
            });
          const reqs = list.map(
            ({ name, photoUrl, thumbnailName, numberOfColors }) => ({
              fileName: `${name}`,
              name: `${name}.png`,
              url: `${photoUrl.split('edit')[0]}`,
              thumbnailName: `${thumbnailName}.png`,
              numberOfColors: `${numberOfColors}`,
            }),
          );
          const buffers = await Promise.all(reqs.map((obj) => download(obj)));
        }
        if (imageURLArray.length === 0) {
          imageURLArray = [row.Goog_Doc_URL.split('?')[0]];
          main();
        } else if (!imageURLArray.includes(row.Goog_Doc_URL.split('?')[0])) {
          imageURLArray.push(row.Goog_Doc_URL.split('?')[0]);
          main();
        }
      })
      .on('end', () => {
        result = {
          message: 'success',
        };
        res.status(200).send(result);
      });
  }, 2000);
};

module.exports = {
  postCustomerArtWork,
  updateCustomerArtWork,
  getCustomerArtWork,
  getPublicArtWork,
  imageEncode,
  removeCustomerArtWork,
  getAdminArtWork,
  getAllArtWorks,
  getArtworkById,
  uploadArtwork,
};
