const mysql = require('sequelize');
require('dotenv').config();

var connection = new mysql(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS, {
      logging: false, // Disables console logging queries
      dialect: 'mysql'
    }
  );
module.exports = connection;
