const multer = require('multer');
const momentTimezone = require('moment-timezone');
const sharp = require('sharp');

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './images');
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});

exports.fileUpload = (fileData) => {
  if (fileData) {
    const ext = fileData.filename.split('.').pop();
    const lastDotPosition = fileData.filename.lastIndexOf('.');
    let imageName = '';
    if (lastDotPosition === -1) {
      imageName = fileData.filename;
    } else {
      imageName = fileData.filename.substr(0, lastDotPosition);
    }
    imageName = imageName.replace(/[^a-zA-Z0-9 ]/g, '');
    if (imageName == '') {
      imageName = 'art_' + fileData.customerID;
    }
    const createdAt = momentTimezone()
      .tz('America/Los_Angeles')
      .format('YYYY-MM-DD-HH:mm:ss');
    const thumbnailImageName =
      imageName +
      '-' +
      fileData.customerID +
      '-' +
      createdAt +
      '_400x200' +
      '.jpeg';
    imageName =
      imageName + '-' + fileData.customerID + '-' + createdAt + '.' + ext;
    const uploadStatus = fileData.imageFile.mv(
      './images/' + fileData.subFolder + '/' + imageName,
    );
    sharp(fileData.imageFile.data)
      .resize(400, 200, {
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .toFormat('jpeg')
      .toFile(
        './images/' + fileData.subFolder + '/' + thumbnailImageName,
        (err, resizeImage) => {
          if (err) {
            console.log(err);
          }
        },
      );
    if (uploadStatus) {
      return {
        status: true,
        fileName: imageName,
        message: 'Successfully uploaded',
        thumbnailImageName: thumbnailImageName,
      };
    }
  } else {
    return {
      status: false,
      fileName: null,
      message: 'Failed to upload the image',
    };
  }
};
