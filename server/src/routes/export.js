const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/questions', exportController.exportQuestions);
router.get('/review-queue', exportController.exportReviewQueue);

module.exports = router;
