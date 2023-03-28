const util = require('util');
const mysql = require('mysql2');
const path = require('path');
const mysqlSeq = require('sequelize');

module.exports = {
  getConn: async function () {
    let con;
    if (
      process.env.ENV == 'production' ||
      process.env.ENV == 'development' ||
      process.env.ENV == 'localhost'
    ) {
      con = new mysqlSeq(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
          logging: false, // Disables console logging queries
          dialect: 'mysql',
        },
      );
    }
    con.authenticate().then(function (err) {
      if (err) throw err;
    });
    return con;
  },
  validateEmail: function (email) {
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  },
  uniqueStr: function (length) {
    if (!length) {
      length = 128;
    }
    let s = [];
    const digits =
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    for (let i = 0; i < length; i++) {
      s[i] = digits.substr(Math.floor(Math.random() * digits.length - 1), 1);
    }
    let guid = s.join('');
    return guid;
  },
  dbQuery: async function (query, param) {
    const con = await this.getConn();
    const data = await con.query(query, param);
    /* con.end(); //Sequelize maintains an internal database connection pool, that's what the pool parameters are for, 
		so this isn't necessary. Each call actually borrows a connection temporarily and then returns it to the pool when done.
		Closing that connection manually may poison the pool and cause performance issues.*/
    return data;
  },
  dbGetSingleRow: async function (query, param) {
    const data = await this.dbQuery(query, param);
    return data[0];
  },
  dbGetSingleValue: async function (query, param, defaultValue) {
    let data = await this.dbGetSingleRow(query, param);
    data = data ?? {};
    data = data.val ?? defaultValue;
    return data;
  },
  dbInsert: async function (query, param) {
    const con = await this.getConn();
    const data = await con.query(query, param);
    // con.end();
    return data[0].insertId;
  },
  resSend(res, data, status, errors) {
    data = data ?? {};
    status = status?.toString() ?? this.resStatuses.ok;
    errors = errors ?? [];
    if (!Array.isArray(errors)) errors = [errors];
    let rspJson = {};
    rspJson.status = status;
    rspJson.errors = errors;
    rspJson.data = data;
    res.send(JSON.stringify(rspJson));
  },
  resStatuses: Object.freeze({ ok: 'OK', error: 'Error' }),
};
