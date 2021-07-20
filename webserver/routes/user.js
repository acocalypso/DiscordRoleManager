const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.home);
router.get('/discorduser', userController.view);

module.exports = router;