const mysql = require('mysql');
const config = require('../../config/config');
const helper = require('../helper');
const sqlite3 = require('sqlite3');
const path = require('path');

const sql = new sqlite3.Database('./database.sqlite');
const wait = async ms => new Promise(done => setTimeout(done, ms));

console.log(dbPath);

sqlConnectionDiscord = mysql.createPool({
	host: config.mysql_database.mysql_host,
	database: config.mysql_database.mysql_db,
	user: config.mysql_database.mysql_user,
	port: config.mysql_database.mysql_port,
	password: config.mysql_database.mysql_pass,
	supportBigNumbers: true
});


// Ping database to check for common exception errors.
sqlConnectionDiscord.getConnection((err, connection) => {
	if (err) {
		if (err.code === 'PROTOCOL_CONNECTION_LOST') {
			console.error('Database connection was closed.')
		}
		if (err.code === 'ER_CON_COUNT_ERROR') {
			console.error('Database has too many connections.')
		}
		if (err.code === 'ECONNREFUSED') {
			console.error('Database connection was refused.')
		}
	}

	if (connection) connection.release()

	return
});


async function InitDB() {
	// Create MySQL tabels
	let currVersion = 5;
	let dbVersion = 0;
	await query(`CREATE TABLE IF NOT EXISTS metadata (
                        \`key\` VARCHAR(50) PRIMARY KEY NOT NULL,
                        \`value\` VARCHAR(50) DEFAULT NULL);`)
		.then(async x => {
			await query(`SELECT \`value\` FROM metadata WHERE \`key\` = "DB_VERSION" LIMIT 1;`)
				.then(async result => {
					//Save the DB version if one is returned
					if (result.length > 0) {
						dbVersion = parseInt(result[0].value);
					}
					console.log(helper.GetTimestamp() + `[InitDB] DB version: ${dbVersion}, Latest: ${currVersion}`);
					if (dbVersion < currVersion) {
						for (dbVersion; dbVersion < currVersion; dbVersion++) {
							if (dbVersion == 0) {
								// Setup the temp roles table
								console.log(helper.GetTimestamp() + '[InitDB] Creating the initial tables');
								await query(`CREATE TABLE IF NOT EXISTS temporary_roles (
                                        userID bigint(19) unsigned NOT NULL,
                                        temporaryRole varchar(35) NOT NULL,
                                        startDate int(11) unsigned NOT NULL,
                                        endDate int(11) unsigned NOT NULL,
                                        addedBy bigint(19) unsigned NOT NULL,
                                        notified tinyint(1) unsigned DEFAULT 0)`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
										process.exit(-1);
									});

								// Migrate the old sqlite entries into the table
								sql.all(`SELECT * FROM temporary_roles`, (err, rows) => {
									if (err) {
										console.error(helper.GetTimestamp() + err.message);
									}
									else if (rows) {
										for (rowNumber = 0; rowNumber < rows.length; rowNumber++) {
											let values = rows[rowNumber].userID + ',\''
												+ rows[rowNumber].temporaryRole + '\','
												+ Math.round(rows[rowNumber].startDate / 1000) + ','
												+ Math.round(rows[rowNumber].endDate / 1000) + ','
												+ rows[rowNumber].addedBy + ','
												+ rows[rowNumber].notified;
											query(`INSERT INTO temporary_roles VALUES(${values});`)
												.catch(err => {
													console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
													process.exit(-1);
												});
										}
									}
								});
								await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
										process.exit(-1);
									});
								console.log(helper.GetTimestamp() + '[InitDB] Migration #1 complete.');
							}
							else if (dbVersion == 1) {
								// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
								console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
								await wait(30 * 1000);
								await query(`ALTER TABLE temporary_roles
                                            ADD COLUMN username varchar(35) DEFAULT NULL;`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
										process.exit(-1);
									});
								await query(`ALTER TABLE \`temporary_roles\` COLLATE='utf8mb4_general_ci', CONVERT TO CHARSET utf8mb4;`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
										process.exit(-1);
									});
								await query(`ALTER TABLE \`metadata\` COLLATE='utf8mb4_general_ci', CONVERT TO CHARSET utf8mb4;`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
										process.exit(-1);
									});
								await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
										process.exit(-1);
									});
								console.log(helper.GetTimestamp() + '[InitDB] Migration #2 complete.');
							}
							else if (dbVersion == 2) {
								// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
								console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
								await wait(30 * 1000);

								await query(`ALTER TABLE \`temporary_roles\` ADD PRIMARY KEY (\`userID\`, \`temporaryRole\`);`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
										process.exit(-1);
									});
								await query(`ALTER TABLE \`metadata\` COLLATE='utf8mb4_general_ci', CONVERT TO CHARSET utf8mb4;`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
										process.exit(-1);
									});
								await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
										process.exit(-1);
									});
								console.log(helper.GetTimestamp() + '[InitDB] Migration #3 complete.');
							}
							else if (dbVersion == 3) {
								// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
								console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
								await wait(30 * 1000);
								await query(`ALTER TABLE \`temporary_roles\` ADD COLUMN leftServer tinyint(1) unsigned DEFAULT 0;`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
										process.exit(-1);
									});
								await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
										process.exit(-1);
									});
								console.log(helper.GetTimestamp() + '[InitDB] Migration #4 complete.');
							}
							else if (dbVersion == 4) {
								// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
								console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
								await wait(30 * 1000);

								await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
									.catch(err => {
										console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
										process.exit(-1);
									});
								console.log(helper.GetTimestamp() + '[InitDB] Migration #5 complete.');
							}
						}
						console.log(helper.GetTimestamp() + '[InitDB] Migration process done.');
					}
				})
				.catch(err => {
					console.error(helper.GetTimestamp() + `[InitDB] Failed to get version info: (${err})`);
					process.exit(-1);
				});
		})
		.catch(err => {
			console.error(helper.GetTimestamp() + `[InitDB] Failed to create metadata table: (${err})`);
			process.exit(-1);
		});
}

async function query(sql, args) {
	return new Promise((resolve, reject) => {
		sqlConnectionDiscord.query(sql, args, (error, results, fields) => {
			if (error) {
				if (error.code === "PROTOCOL_CONNECTION_LOST" || error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
					console.log(helper.GetTimestamp() + "Reconnecting to DB server...");
				}
				else {
					return reject(error);
				}
			}
			return resolve(results);
		});
	});
}
exports.InitDB = InitDB;
exports.query = query;