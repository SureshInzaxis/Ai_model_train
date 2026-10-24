const { sequelize, Subject, Chapter, PDFDocument, Question, ProcessingJob, CorrectedQuestion } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const redis = require('../config/redis');
const ollama = require('../config/ollama');

exports.healthCheck = async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    ollama: false,
  };

  try {
    await sequelize.authenticate();
    checks.database = true;
  } catch (err) {
    checks.database = false;
  }

  try {
    const ping = await redis.connection.ping();
    checks.redis = ping === 'PONG';
  } catch (err) {
    checks.redis = false;
  }

  try {
    const result = await ollama.isAvailable();
    checks.ollama = result.available;
    if (result.available) {
      checks.ollama_models = result.models.map(m => m.name);
    }
  } catch (err) {
    checks.ollama = false;
  }

  const allHealthy = checks.database && checks.ollama;
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: allHealthy,
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    versions: {
      node: process.version,
      sequelize: require('sequelize/package.json').version,
    },
  });
};

exports.dbStats = async (req, res) => {
  const subjectCount = await Subject.count();
  const chapterCount = await Chapter.count();
  const pdfCount = await PDFDocument.count();
  const questionCount = await Question.count();
  const pendingQuestions = await Question.count({ where: { needs_human_review: true } });
  const processingJobs = await ProcessingJob.count({ where: { status: 'running' } });
  const pendingAi = await CorrectedQuestion.count({ where: { ai_status: ['pending', 'running'] } }).catch(() => 0);
  const flaggedReview = await CorrectedQuestion.count({ where: { needs_human_review: true } }).catch(() => 0);
  const approved = await CorrectedQuestion.count({ where: { review_status: 'approved' } }).catch(() => 0);
  const rejected = await CorrectedQuestion.count({ where: { review_status: 'rejected' } }).catch(() => 0);
  const unresolved = await CorrectedQuestion.count({ where: { review_status: 'pending' } }).catch(() => 0);
  const extractionFailures = await PDFDocument.count({ where: { status: 'failed' } });
  const storedCorrected = await CorrectedQuestion.count({ where: { stored_at: { [Op.ne]: null } } }).catch(() => 0);

  res.json({
    success: true,
    stats: {
      subjects: subjectCount,
      chapters: chapterCount,
      pdf_documents: pdfCount,
      questions: questionCount,
      pending_review: pendingQuestions,
      jobs_running: processingJobs,
      pending_ai: pendingAi,
      flagged_review: flaggedReview,
      approved,
      rejected,
      unresolved,
      extraction_failures: extractionFailures,
      corrected_stored: storedCorrected,
    },
    data: {
      subjects: await Subject.findAll({ attributes: ['id', 'name', 'code'], order: [['sort_order', 'ASC']] }),
    },
  });
};
