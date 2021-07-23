const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.login);
router.post('/auth', userController.auth);
router.get('/home', userController.home);
router.get('/discorduser', userController.view);
router.post('/discorduser', userController.find);
router.get('/addDiscordUser', userController.createDiscordForm);
router.post('/addDiscordUser', userController.createDiscordUser);
router.get('/editUser/:id', userController.edit);
router.post('/editUser/:id', userController.update);

router.post('/deleteuser/:id', userController.delete);


module.exports = router;