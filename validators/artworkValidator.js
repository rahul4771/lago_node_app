const Validator = require('validator');
const isEmpty = require('./is-empty');

exports.validateArtworkInputs = (data) => {
  let errors = [];
  if (typeof data.body.customerId === 'undefined') data.body.customerId = '';
  if (typeof data.body.artworkName === 'undefined') data.body.artworkName = '';
  if (Validator.isEmpty(data.body.customerId)) {
    errors.push('Customer id is required');
  }
  if (Validator.isEmpty(data.body.artworkName)) {
    errors.push('Artwork name is required');
  }
  return {
    errors,
    isValid: isEmpty(errors),
  };
};

exports.validateArtworkImage = (req) => {
  if (req.files) {
    let size = req.files['artUrl']['size'];
    let imageType = req.files['artUrl']['mimetype']
      .split('/')
      .pop()
      .toLowerCase();
    let allowedExtension = [
      'jpeg',
      'jpg',
      'png',
      '.gif',
      '.svg',
      'webp',
      'avif',
      'svg+xml',
    ];
    let isValidFile = false;
    let isValidFilesize = false;
    for (let index in allowedExtension) {
      if (imageType === allowedExtension[index]) {
        isValidFile = true;
        break;
      }
    }
    if (size < 16986931) {
      // 16.2 MB for bytes 6291456.
      isValidFilesize = true;
    }
    if (isValidFile && isValidFilesize) {
      return {
        status: true,
      };
    }
    if (!isValidFile) {
      return {
        status: false,
        message: 'Artwork image file type is invalid',
      };
    }
    if (!isValidFilesize) {
      return {
        status: false,
        message: 'Artwork image size is large',
      };
    }
  } else {
    return {
      status: false,
      message: 'Artwork image  is required',
    };
  }
};
