var mysql = require('mysql2');
const config = require('../config/config.json');

var RoleDB = mysql.createPool({
    host: config.mysql_database.mysql_host,
    database: config.mysql_database.mysql_db,
    user: config.mysql_database.mysql_user,
    port: config.mysql_database.mysql_port,
    password: config.mysql_database.mysql_pass
});

module.exports = {

    get_expired_user: function (callback) {
        var expiredUser = "";
        RoleDB.getConnection((err, connection) => {
            if (err) throw err;
            RaidDB.query(`SELECT * FROM temporary_roles;`, (err, result) => {
                if (err) throw err;
                if (!result.length == 0) {
                    var users = result[0].id;
                    var callBackString = {};
                    callBackString.expiredUser = expiredUser;
                    callback(null, callBackString);
                }
                connection.release();
            });
        });
    }
};

