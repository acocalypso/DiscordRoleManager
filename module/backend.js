const express = require('express');
const backend = express();
const config = require('../config/config.json')
const PORT = config.webinterface.backendPort || 9900;
const session = require('express-session');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const database_discord = require('./database/database_discord');
const routes = require('../webserver/routes/user');


function website() {

	backend.use(bodyParser.urlencoded({ extended: false }));
	backend.use(bodyParser.json());
	//Static Files
	backend.use(express.static('../public'));

	//Template Engine
	backend.engine('hbs', exphbs({ extname: '.hbs' }));
	backend.set('view engine', 'hbs');

	backend.use('/', routes);
	
	backend.listen(PORT, () => {
		console.log(`Now listening to requests on Port ${PORT}`)
	});
}

exports.website = website;
