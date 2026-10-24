const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const importController = require('../controllers/importController');
const { upload } = require('../config/upload');

router.post(
  '/',
  upload.single('importFile'),
  [
    body('format').isIn(['csv', 'excel', 'json']).withMessage('Format must be csv, excel, or json'),
    body('subject').optional().isString(),
    body('chapter').optional().isString(),
  ],
  validateRequest,
  importController.importQuestions
);

module.exports = router;
