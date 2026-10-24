const express = require('express');
const { body } = require('express-validator');
const { upload } = require('../config/upload');
const validateRequest = require('../middleware/validateRequest');
const pdfController = require('../controllers/pdfController');

const router = express.Router();

router.post(
  '/upload',
  upload.array('pdfs', parseInt(process.env.MAX_FILES_PER_BATCH || '10', 10)),
  [
    body('subject').notEmpty().withMessage('Subject is required'),
    body('chapter').optional(),
    body('examYear').optional().isInt({ min: 1900, max: 2100 }).withMessage('Invalid year'),
    body('examType').optional().isString().isLength({ max: 50 }),
    body('source').optional().isString().isLength({ max: 255 }),
  ],
  validateRequest,
  pdfController.uploadPdf
);

router.use('/diagrams', express.static(require('path').resolve(__dirname, '../../uploads/diagrams')));
router.get('/', pdfController.listPdfs);
router.get('/:id', pdfController.getPdfById);
router.get('/:id/view', pdfController.viewFile);
router.get('/:id/compare', pdfController.comparePdf);
router.post('/:id/analyze', pdfController.analyzePdf);
router.post('/:id/verify', pdfController.verifyPdf);
router.post('/:id/save-corrected', pdfController.saveCorrected);
router.get('/:id/page/:pageNumber', pdfController.getPageImage);
router.delete('/:id', pdfController.deletePdf);

module.exports = router;
