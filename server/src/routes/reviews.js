const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.get('/queue', reviewController.getReviewQueue);
router.get('/:id/history', reviewController.getReviewHistory);
router.post('/:id/approve', reviewController.approveSuggestion);
router.post('/:id/reject', reviewController.rejectSuggestion);
router.post('/:id/edit', reviewController.editSuggestion);
router.post('/:id/comment', reviewController.addComment);

module.exports = router;
