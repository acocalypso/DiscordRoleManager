require('dotenv').config();
const express = require('express');
const backend = express();
const PORT = process.env.PORT || 9900;
const authRoute = require('./routes/auth');
const session = require('express-session');
const passport = require('passport');
const discordStrategy = require('./strategies/discordstrategie');

function website() {

	backend.use(session({
		secret: 'asdfasdfasdf',
		cookie: {
			maxAge: 60000 * 60 *24
		},
		saveUninitialized: false,
		resave: false
	}));

	backend.use(passport.initialize());
	backend.use(passport.session());

	backend.use('/auth', authRoute);


	backend.listen(PORT, () => {
		console.log(`Now listening to requests on Port ${PORT}`)
	});
}

exports.website = website;
