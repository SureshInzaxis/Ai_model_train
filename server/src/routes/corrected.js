const express = require('express');
const router = express.Router();
const correctedController = require('../controllers/correctedController');

router.get('/', correctedController.listCorrected);
router.get('/:id', correctedController.getCorrectedById);
router.post('/:id/approve', correctedController.approveCorrected);
router.post('/:id/edit', correctedController.editCorrected);
router.post('/:id/verify', correctedController.verifyOne);

module.exports = router;
