const Validator = require('validator');
const isEmpty = require('./is-empty');

const validateComments = (data) => {
  let errors = [];
  if (typeof data.body.order_id === 'undefined') data.body.order_id = '';
  if (typeof data.body.from === 'undefined') data.body.from = '';
  if (typeof data.body.to === 'undefined') data.body.to = '';
  if (typeof data.body.comment === 'undefined') data.body.comment = '';

  if (Validator.isEmpty(data.body.order_id)) {
    errors.push('Order id field is required');
  }
  if (Validator.isEmpty(data.body.from)) {
    errors.push('From field is required');
  }
  if (Validator.isEmpty(data.body.to)) {
    errors.push('To filed is required');
  }
  if (Validator.isEmpty(data.body.comment)) {
    errors.push('Comment field is required');
  }
  return {
    errors,
    isValid: isEmpty(errors),
  };
};

module.exports = {
  validateComments,
};
