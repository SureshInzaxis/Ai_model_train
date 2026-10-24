const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.get('/', jobController.listJobs);
router.get('/stats', jobController.getJobStats || ((req, res) => res.json({ success: true, data: {} })));
router.get('/:id', jobController.getJobStatus);
router.post('/:id/retry', jobController.retryJob);
router.post('/verification/:id/retry', jobController.retryJob);

router.post('/verify', jobController.queueVerification);

module.exports = router;
