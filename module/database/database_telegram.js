const mysql = require('mysql');
const config = require('../../config/config');
const helper = require('../helper');
const wait = async ms => new Promise(done => setTimeout(done, ms));


function SQLConnect() {
	return new Promise(function (resolve, reject) {
		sqlConnection = mysql.createConnection({
			host: config.telegram.tele_db_host,
			database: config.telegram.tele_db_name,
			user: config.telegram.tele_db_user,
			port: config.telegram.tele_db_port,
			password: config.telegram.tele_db_pass,
			supportBigNumbers: true
		});
		sqlConnection.connect(function (err) {
			if (err) {
				return reject;
			}
			console.log(helper.GetTimestamp() + "SQL connection etablished! - TelegramDB");
			resolve(true);
		});
	});
}

/*async function query(sql, args) {
	return new Promise((resolve, reject) => {
		sqlConnection.query(sql, args, (error, results, fields) => {
			if (error) {
				if (error.code === "PROTOCOL_CONNECTION_LOST" || error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
					console.log(helper.GetTimestamp() + "Reconnecting to DB server...");
					SQLConnect().then(result => query(sql, args));
				}
				else {
					return reject(error);
				}
			}
			return resolve(results);
		});
	});
}
exports.query = query;
*/
exports.SQLConnect = SQLConnect;
