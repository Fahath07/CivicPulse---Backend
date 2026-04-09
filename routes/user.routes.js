const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { auth } = require('../middleware/auth.middleware');

router.use(auth);

router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.put('/password', ctrl.updatePassword);
router.get('/notifications', ctrl.getNotifications);
router.patch('/notifications/read-all', ctrl.markAllRead);
router.put('/notifications/prefs', ctrl.updateNotifPrefs);

module.exports = router;
