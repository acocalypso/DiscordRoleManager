const { User } = require('eris');
const database_discord = require('../../module/database/database_discord');
const helper = require('../../module/helper');

exports.view = (req, res) => {
	database_discord.query(`SELECT * FROM temporary_roles`)
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + i18n.__("No one is in the DataBase"));
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

	database_discord.query('SELECT * FROM temporary_roles WHERE username like ?', ['%' + searchTerm + '%'])
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
	const { d_username, d_userid, d_role, flexRadioDiscord, flexRadioTelegram } = req.body;
	database_discord.query('INSERT INTO temporary_roles SET userID = ?, temporaryRole = ?, startDate = 0, endDate = 0, addedBy = 0, notified = 0, username = ?, leftServer = 0', [d_userid, d_role, d_username])
		.then(async result => {
			res.render('discorduser');
			console.log("Saved new User into Database")
		}).catch(err => {
			console.error(helper.GetTimestamp() + "[ManualDBEntry] Failed to execute query" + `(${err})`);
			res.render('discorduser');
			return;
		});;

}

exports.edit = (req, res) => {

	database_discord.query('SELECT * FROM temporary_roles WHERE userID = ?', [req.params.id])
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + "[EditUser] User not found");
				return;
			}
			else {
				res.render('editUser', {rows});
			}
		});

}