const { Worker } = require('bullmq');
const logger = require('../config/logger');
const redis = require('../config/redis');
const { Question, VerificationResult, ProcessingJob, PDFDocument } = require('../models');
const ollamaVerification = require('../services/ollamaService');

const concurrency = parseInt(process.env.VERIFICATION_CONCURRENCY || '2', 10);

const worker = new Worker(
  'ai:verification',
  async (job) => {
    const { questionId, questionIds, type, correctedIds } = job.data;

    if (type === 'correction' && Array.isArray(correctedIds) && correctedIds.length) {
      const CorrectionService = require('../services/correctionService');
      const result = await CorrectionService.verifyMany(correctedIds);
      return { type: 'correction', ...result };
    }

    if (questionIds && Array.isArray(questionIds)) {
      const questions = await Question.findAll({
        where: { id: questionIds, review_status: 'pending' },
        limit: parseInt(process.env.JOB_BATCH_SIZE || '10', 10),
      });

      let processed = 0;
      let failed = 0;

      for (const q of questions) {
        try {
          const result = await ollamaVerification.verifyQuestion(q);
          await VerificationResult.create({
            question_id: q.id,
            ...result,
          });

          await q.update({
            verified_answer_key: result.suggested_answer,
            suggested_explanation: result.suggested_explanation,
            ai_confidence: result.confidence,
            needs_human_review: result.needs_human_review || result.confidence < 70,
            review_status: result.needs_human_review ? 'pending' : 'pending',
          });

          processed++;
          await job.progress(processed, questions.length);
        } catch (error) {
          failed++;
          logger.error(`Verification failed for question ${q.id}:`, error.message);
        }
      }

      return { processed, failed, total: questions.length };
    }

    if (questionId) {
      const question = await Question.findByPk(questionId);
      if (!question) {
        throw new Error(`Question not found: ${questionId}`);
      }

      const result = await ollamaVerification.verifyQuestion(question);
      await VerificationResult.create({
        question_id: question.id,
        ...result,
      });

      await question.update({
        verified_answer_key: result.suggested_answer,
        suggested_explanation: result.suggested_explanation,
        ai_confidence: result.confidence,
        needs_human_review: result.needs_human_review || result.confidence < 70,
        review_status: result.needs_human_review ? 'pending' : 'pending',
      });

      return { questionId: question.id, success: true };
    }

    throw new Error('Job must specify questionId or questionIds');
  },
  {
    connection: redis.connection,
    concurrency,
    lockDuration: 600000,
  }
);

worker.on('completed', (job) => {
  logger.info(`Verification worker completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`Verification worker failed job ${job.id}:`, err.message);
});

worker.on('error', (err) => {
  logger.error('Verification worker error:', err.message);
});

logger.info('AI verification worker started');

module.exports = worker;
