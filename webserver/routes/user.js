const express = require('express');

const router = express.Router();
const userController = require('../controllers/userController');

const requireAuth = (req, res, next) => {
	if (req.session && req.session.loggedin === true) {
		return next();
	}
	return res.status(401).json({ error: 'Unauthorized' });
};

router.get('/api/csrf', userController.csrf);
router.get('/api/session', userController.session);
router.post('/api/login', userController.login);
router.post('/api/logout', userController.logout);

router.get('/api/users', requireAuth, userController.listUsers);
router.post('/api/users', requireAuth, userController.createUser);
router.put('/api/users', requireAuth, userController.updateUser);
router.delete('/api/users', requireAuth, userController.deleteUser);

module.exports = router;
