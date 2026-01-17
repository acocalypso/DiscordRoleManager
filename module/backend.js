const bodyParser = require('body-parser');
const session = require('express-session');
const express = require('express');
const lusca = require('lusca');
const path = require('path');
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

  backend.use(lusca.csrf());

  // Static Files (React app)
  backend.use(express.static(path.join(__dirname, '../public')));

  backend.use('/', routes);

  backend.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
  backend.listen(PORT, () => {
    console.log(`Now listening to requests on Port ${PORT}`);
  });
}

exports.website = website;
