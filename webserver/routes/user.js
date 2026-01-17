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

router.get('/api/guilds', requireAuth, userController.listGuilds);
router.get('/api/guilds/:guildId/members', requireAuth, userController.listMembers);
router.get('/api/guilds/:guildId/roles', requireAuth, userController.listRoles);

router.get('/api/users', requireAuth, userController.listUsers);
router.post('/api/users', requireAuth, userController.createUser);
router.put('/api/users', requireAuth, userController.updateUser);
router.delete('/api/users', requireAuth, userController.deleteUser);

router.post('/api/temprole/assign', requireAuth, userController.assignTempRole);

module.exports = router;
