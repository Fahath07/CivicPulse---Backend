const router = require('express').Router();
const ctrl = require('../controllers/issue.controller');
const { auth } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

router.get('/public', ctrl.getPublic);
router.get('/check-duplicate', ctrl.checkDuplicate);
router.get('/my', auth, ctrl.getMy);
router.get('/assigned', auth, ctrl.getAssigned);
router.get('/:id', ctrl.getById);
router.post('/', auth, upload.array('photos', 5), ctrl.create);
router.patch('/:id/status', auth, upload.array('resolutionPhotos', 5), ctrl.updateStatus);
router.post('/:id/verify', auth, ctrl.verifyResolution);
router.post('/:id/vote', auth, ctrl.vote);
router.get('/:id/comments', ctrl.getComments);
router.post('/:id/comments', auth, ctrl.addComment);

module.exports = router;
