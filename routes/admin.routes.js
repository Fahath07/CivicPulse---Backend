const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { auth, adminOnly } = require('../middleware/auth.middleware');

router.use(auth, adminOnly);

router.get('/stats', ctrl.getStats);
router.get('/issues', ctrl.getIssues);
router.patch('/issues/bulk', ctrl.bulkUpdate);
router.get('/fieldworkers', ctrl.getFieldWorkers);
router.post('/fieldworkers', ctrl.createFieldWorker);
router.delete('/fieldworkers/:id', ctrl.deleteFieldWorker);
router.post('/assign', ctrl.assign);

module.exports = router;
