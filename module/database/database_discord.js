const mysql = require('mysql');
const config = require('../../config/config.json');
const helper = require('../helper');

const wait = async (ms) => new Promise((done) => setTimeout(done, ms));

const sqlConnectionDiscord = mysql.createPool({
  connectionLimit: 10,
  connectTimeout: 60 * 60 * 1000,
  acquireTimeout: 60 * 60 * 1000,
  timeout: 60 * 60 * 1000,
  host: config.mysql_database.mysql_host,
  database: config.mysql_database.mysql_db,
  user: config.mysql_database.mysql_user,
  port: config.mysql_database.mysql_port,
  password: config.mysql_database.mysql_pass,
  supportBigNumbers: true,
  timezone: 'Europe/Berlin',
});

// Ping database to check for common exception errors.
sqlConnectionDiscord.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      helper.myLogger.error(helper.GetTimestamp + ' Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      helper.myLogger.error(helper.GetTimestamp + ' Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
      helper.myLogger.error(helper.GetTimestamp + ' Database connection was refused.');
    }
  }

  if (connection) connection.release();
});

async function query(sql, args) {
  return new Promise((resolve, reject) => {
    sqlConnectionDiscord.query(sql, args, (error, results, fields) => {
      if (error) {
        if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
          helper.myLogger.log(helper.GetTimestamp() + 'Reconnecting to DB server...');
        } else {
          return reject(error);
        }
      }
      return resolve(results);
    });
    // sqlConnectionDiscord.connection.release();
  });
}

async function InitDB() {
  // Create MySQL tabels
  const currVersion = 9;
  let dbVersion = 0;
  await query(`CREATE TABLE IF NOT EXISTS metadata (
                        \`key\` VARCHAR(50) PRIMARY KEY NOT NULL,
                        \`value\` VARCHAR(50) DEFAULT NULL);`)
    .then(async () => {
      await query('SELECT `value` FROM metadata WHERE `key` = "DB_VERSION" LIMIT 1;')
        .then(async (result) => {
          // Save the DB version if one is returned
          if (result.length > 0) {
            dbVersion = parseInt(result[0].value, 10);
          }
          helper.myLogger.log(helper.GetTimestamp() + `[InitDB] DB version: ${dbVersion}, Latest: ${currVersion}`);
          if (dbVersion < currVersion) {
            for (dbVersion; dbVersion < currVersion; dbVersion += 1) {
              if (dbVersion === 0) {
                // Setup the temp roles table
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Creating the initial tables');
                await query(`CREATE TABLE IF NOT EXISTS temporary_roles (
                                        userID bigint(19) unsigned NOT NULL,
                                        temporaryRole varchar(35) NOT NULL,
                                        startDate int(11) unsigned NOT NULL,
                                        endDate int(11) unsigned NOT NULL,
                                        addedBy bigint(19) unsigned NOT NULL,
                                        notified tinyint(1) unsigned DEFAULT 0)`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });
                if (config.migrateSQLITE.migrate === true) {
                  // Migrate the old sqlite entries into the table
                  // eslint-disable-next-line global-require
                  const db = require('better-sqlite3')(config.migrateSQLITE.path);
                  const rows = db.prepare('SELECT * FROM temporary_roles').all();
                  if (rows.length === 0) { helper.myLogger.error(helper.GetTimestamp() + ' No rows to import'); } else if (rows) {
                    for (let rowNumber = 0; rowNumber < rows.length; rowNumber += 1) {
                      const values = rows[rowNumber].userID + ',\''
                                 + rows[rowNumber].temporaryRole + '\','
                                 + Math.round(rows[rowNumber].startDate / 1000) + ','
                                 + Math.round(rows[rowNumber].endDate / 1000) + ','
                                 + rows[rowNumber].addedBy + ','
                                 + rows[rowNumber].notified;
                      query(`INSERT INTO temporary_roles VALUES(${values});`)
                        .catch((err) => {
                          helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                          process.exit(-1);
                        });
                    }
                  }
                }

                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Migration #1 complete.');
              } else if (dbVersion === 1) {
                // Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);
                await query(`ALTER TABLE temporary_roles
                                            ADD COLUMN username varchar(35) DEFAULT NULL;`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE `temporary_roles` COLLATE=\'utf8mb4_general_ci\', CONVERT TO CHARSET utf8mb4;')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE `metadata` COLLATE=\'utf8mb4_general_ci\', CONVERT TO CHARSET utf8mb4;')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
                    process.exit(-1);
                  });
                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Migration #2 complete.');
              } else if (dbVersion === 2) {
                // Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);

                await query('ALTER TABLE `temporary_roles` ADD PRIMARY KEY (`userID`, `temporaryRole`);')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE `metadata` COLLATE=\'utf8mb4_general_ci\', CONVERT TO CHARSET utf8mb4;')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
                    process.exit(-1);
                  });
                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Migration #3 complete.');
              } else if (dbVersion === 3) {
                // Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);
                await query('ALTER TABLE `temporary_roles` ADD COLUMN leftServer tinyint(1) unsigned DEFAULT 0;')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });
                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Migration #4 complete.');
              } else if (dbVersion === 4) {
                // Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);

                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Migration #5 complete.');
              } else if (dbVersion === 5) {
                // Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);

                await query(`CREATE TABLE IF NOT EXISTS login (
                                        id int(11) NOT NULL,
                                        username varchar(50) NOT NULL,
                                        password varchar(255) NOT NULL)`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE login ADD PRIMARY KEY (id)')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE login MODIFY id int(11) NOT NULL AUTO_INCREMENT')
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                    process.exit(-1);
                  });
                const encPW = await helper.encryptPassword(config.webinterface.password);
                await query(`INSERT INTO login (\`username\`,\`password\`) VALUES ('${config.webinterface.username}','${encPW}')`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
                    process.exit(-1);
                  });
                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}e: (${err})`);
                    process.exit(-1);
                  });
                helper.myLogger.log(helper.GetTimestamp() + '[InitDB] Migration #6 complete.');
              } else if (dbVersion === 6) {
                // Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
                console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);

                await query('ALTER TABLE temporary_roles ADD guild_id bigint(20);')
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });

                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                console.log(helper.GetTimestamp() + '[InitDB] Migration #7 complete.');
              } else if (dbVersion === 7) {
                console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);

                await query(`CREATE TABLE IF NOT EXISTS registration (
                                        id int(11) NOT NULL,
                                        guild_id bigint(50) NOT NULL,
                                        guild_name varchar(255) NOT NULL)`)
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE registration ADD PRIMARY KEY (id)')
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE registration MODIFY id int(11) NOT NULL AUTO_INCREMENT')
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                    process.exit(-1);
                  });
                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                console.log(helper.GetTimestamp() + '[InitDB] Migration #8 complete.');
              } else if (dbVersion === 8) {
                console.log(helper.GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
                await wait(30 * 1000);

                await query('ALTER TABLE registration ADD COLUMN mainChannelID bigint(50);')
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE registration ADD COLUMN adminRoleName bigint(50);')
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                    process.exit(-1);
                  });
                await query('ALTER TABLE registration ADD COLUMN modRoleName bigint(50);')
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
                    process.exit(-1);
                  });
                await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
                  .catch((err) => {
                    console.error(helper.GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
                    process.exit(-1);
                  });
                console.log(helper.GetTimestamp() + '[InitDB] Migration #9 complete.');
              }
            }
            console.log(helper.GetTimestamp() + '[InitDB] Migration process done.');
          }
        })
        .catch((err) => {
          console.error(helper.GetTimestamp() + `[InitDB] Failed to get version info: (${err})`);
          process.exit(-1);
        });
    })
    .catch((err) => {
      console.error(helper.GetTimestamp() + `[InitDB] Failed to create metadata table: (${err})`);
      process.exit(-1);
    });
}

exports.InitDB = InitDB;
exports.query = query;
