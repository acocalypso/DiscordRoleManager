const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const session = require('express-session');
const express = require('express');
const config = require('../config/config.json');

const backend = express();
const PORT = config.webinterface.backendPort || 9900;

const routes = require('../webserver/routes/user');

function website() {
  backend.use(session({
    name: 'rolebot',
    cookie: {
      path: '/',
      name: 'rolebot',
      maxAge: 1000 * 60 * 24,
    },
    secret: config.webinterface.secret,
    resave: true,
    saveUninitialized: true,
  }));

  backend.use(bodyParser.urlencoded({ extended: false }));
  backend.use(bodyParser.json());
  // Static Files
  backend.use(express.static('../public'));

  // Template Engine
  backend.engine('hbs', exphbs.engine({ extname: '.hbs' }));
  backend.set('view engine', 'hbs');

  backend.use('/', routes);
  backend.listen(PORT, () => {
    console.log(`Now listening to requests on Port ${PORT}`);
  });
}

exports.website = website;
