const { ProcessingJob, PDFDocument } = require('../models');
const queueManager = require('../jobs/queueManager');
const logger = require('../config/logger');

exports.getJobStats = async (req, res, next) => {
  try {
    const queueStats = await queueManager.getJobStats().catch(() => ({
      extraction: {},
      verification: {},
    }));

    const processingJobs = await ProcessingJob.findAll({
      where: { status: ['running', 'pending'] },
      attributes: ['id', 'job_type', 'status', 'progress', 'total_items', 'processed_items', 'started_at', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 20,
    });

    res.json({
      success: true,
      data: {
        queue_stats: queueStats,
        active_jobs: processingJobs,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getJobStatus = async (req, res, next) => {
  try {
    const job = await ProcessingJob.findByPk(req.params.id, {
      include: [{ model: PDFDocument, as: 'pdf_document' }],
    });

    if (!job) {
      const { extractionQueue } = queueManager.getQueues();
      let bullJob = await extractionQueue.getJob(req.params.id);
      if (!bullJob) {
        const { verificationQueue } = queueManager.getQueues();
        bullJob = await verificationQueue.getJob(req.params.id);
      }
      if (bullJob) {
        return res.json({ success: true, data: bullJob });
      }
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

exports.retryJob = async (req, res, next) => {
  try {
    const job = await ProcessingJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (['completed', 'running'].includes(job.status)) {
      return res.status(400).json({ success: false, message: 'Job cannot be retried in current status' });
    }

    job.status = 'pending';
    job.error = null;
    job.completed_at = null;
    await job.save();

    const jobData = JSON.parse(job.configuration || '{}');
    if (job.job_type === 'extraction') {
      await queueManager.addExtractionJob({
        pdfDocumentId: job.pdf_document_id,
        ...jobData,
      });
    } else if (job.job_type === 'verification') {
      await queueManager.addVerificationJob({
        questionIds: job.question_ids,
        ...jobData,
      });
    }

    res.json({ success: true, message: 'Job retried', data: job });
  } catch (err) {
    next(err);
  }
};

exports.listJobs = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const where = {};

    if (type) where.job_type = type;
    if (status) where.status = status;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows: jobs } = await ProcessingJob.findAndCountAll({
      where,
      include: [{ model: PDFDocument, as: 'pdf_document', attributes: ['id', 'filename', 'status'] }],
      limit: parseInt(limit, 10),
      offset,
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        pages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.queueVerification = async (req, res, next) => {
  try {
    const { questionId, subject, chapter, examYear, needsReviewOnly } = req.body;
    const { Question } = require('../models');
    const { Op } = require('sequelize');

    let questionIds;

    if (questionId) {
      questionIds = [questionId];
    } else {
      const where = {};
      if (subject) where.subject_id = subject;
      if (chapter) where.chapter_id = chapter;
      if (needsReviewOnly === true || needsReviewOnly === 'true') {
        where.needs_human_review = true;
      }
      const questions = await Question.findAll({ where, limit: 100 });
      questionIds = questions.map(q => q.id);
    }

    if (questionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No questions found to verify' });
    }

    const batchSize = parseInt(process.env.JOB_BATCH_SIZE || '10', 10);
    const batches = [];
    for (let i = 0; i < questionIds.length; i += batchSize) {
      batches.push(questionIds.slice(i, i + batchSize));
    }

    const jobIds = [];
    for (const batch of batches) {
      const job = await queueManager.addVerificationJob({ questionIds: batch });
      jobIds.push(job.id);

      await ProcessingJob.create({
        job_type: 'verification',
        status: 'pending',
        total_items: batch.length,
        concurrency: parseInt(process.env.VERIFICATION_CONCURRENCY || '2', 10),
        batch_size: batchSize,
        question_ids: JSON.stringify(batch),
        configuration: JSON.stringify({ subject, chapter, examYear, needsReviewOnly }),
      });
    }

    res.status(201).json({
      success: true,
      message: `Queued ${questionIds.length} questions for verification across ${jobIds.length} batches`,
      jobIds,
    });
  } catch (err) {
    next(err);
  }
};
