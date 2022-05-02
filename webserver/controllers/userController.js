const sqlConnectionDiscord = require('../../module/database/database_discord');
const helper = require('../../module/helper');
const bcrypt = require('bcrypt');

exports.view = (req, res) => {
	sess = req.session;
	if (sess.username && sess.loggedin == true) {
		sqlConnectionDiscord.query(`SELECT UserID, username, temporaryRole, FROM_UNIXTIME(endDate) as endDate FROM temporary_roles`)
			.then(async rows => {
				if (!rows[0]) {
					console.info(helper.GetTimestamp() + "No one is in the DataBase");
					return;
				} else {

					res.render('discorduser', { rows });
				}
			});
	} else {
		console.log("Invalid access");
		res.render('login');
	}
}


exports.home = (req, res) => {
	sess = req.session;
	console.log(sess.username);

	if (sess.username && sess.loggedin == true) {

		sqlConnectionDiscord.query(`SELECT UserID, username, temporaryRole, FROM_UNIXTIME(endDate,"%d.%m.%Y %H:%i:%S") as endDate FROM temporary_roles where notified = 1 ORDER BY endDate asc`)
			.then(async rows => {
				if (!rows[0]) {
					console.info(helper.GetTimestamp() + "No one is in the DataBase");
					return;
				} else {
					res.render('home', { rows,username: sess.username });
				}
				});
	} else {
		console.log("Invalid access");
		res.render('login');
	}
}

exports.createDiscordForm = (req, res) => {
	sess = req.session;
	if (sess.username && sess.loggedin == true) {
		res.render('addDiscordUser');
	} else {
		console.log("Invalid access");
		res.render('login');
	}
}

exports.createDiscordUser = (req, res) => {
	sess = req.session;
	if (sess.username && sess.loggedin == true) {
		const { d_username, d_userid, d_role } = req.body;
		sqlConnectionDiscord.query('INSERT INTO temporary_roles SET userID = ?, temporaryRole = ?, startDate = 0, endDate = 0, addedBy = 0, notified = 0, username = ?, leftServer = 0', [d_userid, d_role, d_username])
			.then(async result => {
				res.render('discorduser');
				console.log("Saved new User into Database")
			}).catch(err => {
				console.error(helper.GetTimestamp() + "[ManualDBEntry] Failed to execute query" + `(${err})`);
				res.render('addDiscordUser', { alert: 'User added successfully.' });
				return;
			});
	} else {
		console.log("Invalid access");
		res.render('login');
	}

}

exports.edit = (req, res) => {
	sess = req.session;
	if (sess.username && sess.loggedin == true) {

		sqlConnectionDiscord.query('SELECT UserID, username, temporaryRole, FROM_UNIXTIME(endDate,"%d.%m.%Y %H:%i:%S") as endDate FROM temporary_roles WHERE UserID = ?', [req.params.id])
			.then(async rows => {
				if (!rows[0]) {
					console.info(helper.GetTimestamp() + "[EditUser] User not found");
					return;
				}
				else {
					res.render('editUser', { rows, alert: `{$UserID} has been updated.` });
				}
			});
	} else {
		console.log("Invalid access");
		res.render('login');
	}
}

exports.update = (req, res) => {

		const { d_username, d_userid, d_role } = req.body;
		sqlConnectionDiscord.query('UPDATE temporary_roles SET userID = ?, temporaryRole = ?, username = ? WHERE id = ?', [d_userid, d_role, d_username, req.params.id])
			.then(async rows => {
				if (!rows[0]) {
					console.info(helper.GetTimestamp() + "[EditUser] User not found");
					return;
				}
				else {
					res.render('editUser', { rows, alert: `{$userID} has been updated.` });
				}
			});
}

exports.delete = (req, res) => {
	sess = req.session;
	if (sess.username && sess.loggedin == true) {
		sqlConnectionDiscord.query('DELETE FROM temporary_roles WHERE userID = ?', [req.params.id])
			.then(async rows => {
				if (!rows[0]) {
					console.info(helper.GetTimestamp() + "[DeleteUser] Error");
					return;
				}
				else {
					res.render('deleteUser');
				}
			});
	} else {
		console.log("Invalid access");
		res.render('login');
    }

}

exports.login = (req, res) => {
	sess = req.session;
	if (sess.username && sess.loggedin == true) {
		res.render('home', {username: sess.username});
	} else {
		res.render('login', { layout: 'login' });
	}
}

exports.auth = (req, res) => {
	const { login_username, login_password } = req.body;

	if (login_username && login_password) {

		sqlConnectionDiscord.query('SELECT password FROM login WHERE username = ?', [login_username])
			.then(async rows => {
				if (!rows[0]) {
					console.info(helper.GetTimestamp() + "[Login] User not found");
					res.send('User not found!');
					return;
				}
				else {
					if (bcrypt.compareSync(login_password, rows[0].password)) {
						req.session.loggedin = true;
						req.session.username = login_username;
						console.log(req.session.username);
						res.render('home', {username: req.session.username});
					}
				}
			});
	}
}