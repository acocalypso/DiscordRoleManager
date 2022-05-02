const express = require('express');
const backend = express();
const session = require('express-session');
const config = require('../config/config.json')
const PORT = config.webinterface.backendPort || 9900;
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const routes = require('../webserver/routes/user');

function website() {

	backend.use(session({
		name: "rolebot",
		cookie: {
			path: "/",
			name: "rolebot",
			maxAge: 1000 * 60 * 24
		},
		secret: config.webinterface.secret,
		resave: true,
		saveUninitialized: true
	}));

	backend.use(bodyParser.urlencoded({ extended: false }));
	backend.use(bodyParser.json());
	//Static Files
	backend.use(express.static('../public'));

	//Template Engine
	backend.engine('hbs', exphbs.engine({ extname: '.hbs' }));
	backend.set('view engine', 'hbs');

	backend.use('/', routes);
	
	backend.listen(PORT, () => {
		console.log(`Now listening to requests on Port ${PORT}`)
	});
}

exports.website = website;
