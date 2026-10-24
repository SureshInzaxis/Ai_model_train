const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.get('/', questionController.listQuestions);
router.get('/options', questionController.listOptions);
router.get('/stable/:stableId', questionController.getQuestionByStableId);
router.get('/:id', questionController.getQuestionById);

module.exports = router;
