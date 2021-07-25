const database_discord = require('../../module/database/database_discord');
const helper = require('../../module/helper');
const bcrypt = require('bcrypt');

exports.view = (req, res) => {
	database_discord.query(`SELECT UserID, username, temporaryRole, FROM_UNIXTIME(endDate) as endDate FROM temporary_roles`)
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + "No one is in the DataBase");
				return;
			} else {

				res.render('discorduser', { rows });
			}
		});
}

exports.home = (req, res) => {
	res.render('home');
}

exports.find = (req, res) => {

	let searchTerm = req.body.search;

	database_discord.query('SELECT UserID, username, temporaryRole, FROM_UNIXTIME(endDate) as endDate FROM temporary_roles WHERE username like ?', ['%' + searchTerm + '%'])
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + "No one is in the DataBase");
				return;
			}
			else {

				res.render('discorduser', { rows });
			}
		});
}

exports.createDiscordForm = (req, res) => {
	res.render('addDiscordUser');
}

exports.createDiscordUser = (req, res) => {
	const { d_username, d_userid, d_role } = req.body;
	database_discord.query('INSERT INTO temporary_roles SET userID = ?, temporaryRole = ?, startDate = 0, endDate = 0, addedBy = 0, notified = 0, username = ?, leftServer = 0', [d_userid, d_role, d_username])
		.then(async result => {
			res.render('discorduser');
			console.log("Saved new User into Database")
		}).catch(err => {
			console.error(helper.GetTimestamp() + "[ManualDBEntry] Failed to execute query" + `(${err})`);
			res.render('addDiscordUser', {alert: 'User added successfully.'});
			return;
		});;

}

exports.edit = (req, res) => {

	database_discord.query('SELECT UserID, username, temporaryRole, FROM_UNIXTIME(endDate) FROM temporary_roles WHERE userID = ?', [req.params.id])
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + "[EditUser] User not found");
				return;
			}
			else {
				res.render('editUser', {rows, alert: `{$userID} has been updated.`});
			}
		});
}

exports.update = (req, res) => {
	const { d_username, d_userid, d_role } = req.body;
	database_discord.query('UPDATE temporary_roles SET userID = ?, temporaryRole = ?, username = ? WHERE id = ?', [d_userid, d_role, d_username, req.params.id])
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

	database_discord.query('DELETE FROM temporary_roles WHERE userID = ?', [req.params.id])
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + "[DeleteUser] Error");
				return;
			}
			else {
				res.render('deleteUser');
			}
		});

}

exports.login = (req, res) => {
	res.render('login', {layout: 'login'});
}

exports.auth = (req, res) => {
	const { login_username, login_password } = req.body;

	if (login_username && login_password) {

		database_discord.query('SELECT password FROM login WHERE username = ?', [login_username])
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
						res.render('home');
					}
				}
			});
	}
}