const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.home);
router.get('/discorduser', userController.view);
router.post('/discorduser', userController.find);
router.get('/addDiscordUser', userController.createDiscordForm);
router.post('/addDiscordUser', userController.createDiscordUser);
module.exports = router;