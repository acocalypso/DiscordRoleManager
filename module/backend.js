const bodyParser = require('body-parser');
const session = require('express-session');
const express = require('express');
const lusca = require('lusca');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('../config/config.json');

const backend = express();
const PORT = config.webinterface.backendPort || 9900;

const routes = require('../webserver/routes/user');

function website(bot) {
  if (bot) {
    backend.set('discordBot', bot);
  }
  backend.set('trust proxy', 1);
  const webLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  backend.use(session({
    name: 'rolebot',
    cookie: {
      path: '/',
      name: 'rolebot',
      maxAge: 1000 * 60 * 24,
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
    },
    secret: config.webinterface.secret,
    resave: true,
    saveUninitialized: true,
  }));

  backend.use(bodyParser.urlencoded({ extended: false }));
  backend.use(bodyParser.json());

  backend.use(lusca.csrf());

  // Static Files (React app)
  backend.use(webLimiter);
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
