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