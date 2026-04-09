const router = require('express').Router();
const { register, login, logout, me } = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', auth, me);

module.exports = router;
