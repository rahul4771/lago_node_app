const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function (req, res, next) {
  const token = req.header('access-token');
  if (!token) {
    return res.status(400).json({
      message: 'error',
      body: {
        error: 'Access Denied!, no token entered',
      },
    });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(600).json({
      message: 'error',
      data: {
        error: 'Failed to varify the user.',
      },
    });
  }
};
