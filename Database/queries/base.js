const mysql = require('mysql'); // TODO consider switching to mysql2 here
const util = require('util');

// TODO investigate transactions: https://github.com/mysqljs/mysql#transactions
// TODO investigate pooling: https://github.com/mysqljs/mysql#pooling-connections
// TODO don't pass around the connection like this !
module.exports = async function (con, query, params) {
  // ugh node-mysql doesn't have built-in promise support
  const promise = util.promisify(con.query).bind(con);

  // see https://github.com/mysqljs/mysql#preparing-queries
  let sql = query;
  sql = mysql.format(sql, params);
  // console.info(`Running query:\n ${sql}`);

  // const connection = req.connect();

  // console.info(`Received data:\n ${util.inspect(data)}`);

  // TODO exception handling
  return await promise(sql);
};
