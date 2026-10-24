const { Queue, Worker, QueueScheduler, QueueEvents } = require('bullmq');
const logger = require('../config/logger');
const redis = require('../config/redis');

const extractionQueueName = 'pdf:extraction';
const verificationQueueName = 'ai:verification';

let extractionQueue = null;
let verificationQueue = null;
let extractionScheduler = null;
let verificationScheduler = null;
let extractionEvents = null;
let verificationEvents = null;

const getQueues = () => {
  const connection = redis.connection;

  if (!extractionQueue) {
    extractionQueue = new Queue(extractionQueueName, { connection });
    extractionScheduler = new QueueScheduler(extractionQueueName, { connection });
    extractionEvents = new QueueEvents(extractionQueueName, { connection });
  }

  if (!verificationQueue) {
    verificationQueue = new Queue(verificationQueueName, { connection });
    verificationScheduler = new QueueScheduler(verificationQueueName, { connection });
    verificationEvents = new QueueEvents(verificationQueueName, { connection });
  }

  return { extractionQueue, verificationQueue, connection };
};

const addExtractionJob = async (jobData, options = {}) => {
  const { extractionQueue: queue } = getQueues();
  const job = await queue.add('extract', jobData, {
    attempts: parseInt(process.env.JOB_MAX_RETRIES || '3', 10),
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
    ...options,
  });
  logger.info(`Extraction job ${job.id} added for PDF document ${jobData.pdfDocumentId}`);
  return job;
};

const addVerificationJob = async (jobData, options = {}) => {
  const { verificationQueue: queue } = getQueues();
  const job = await queue.add('verify', jobData, {
    attempts: parseInt(process.env.JOB_MAX_RETRIES || '3', 10),
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: true,
    removeOnFail: false,
    ...options,
  });
  logger.info(`Verification job ${job.id} added for question ${jobData.questionId || 'batch'}`);
  return job;
};

const getJobStats = async () => {
  const { extractionQueue: extQueue, verificationQueue: verQueue } = getQueues();

  const [extStats, verStats] = await Promise.all([
    extQueue.getJobCounts(),
    verQueue.getJobCounts(),
  ]);

  return {
    extraction: {
      waiting: extStats.waiting,
      active: extStats.active,
      completed: extStats.completed,
      failed: extStats.failed,
      delayed: extStats.delayed,
      paused: 0,
    },
    verification: {
      waiting: verStats.waiting,
      active: verStats.active,
      completed: verStats.completed,
      failed: verStats.failed,
      delayed: verStats.delayed,
    },
  };
};

const closeQueues = async () => {
  const queues = [extractionQueue, verificationQueue, extractionScheduler, verificationScheduler];
  for (const q of queues) {
    if (q) {
      await q.close();
    }
  }
  extractionQueue = null;
  verificationQueue = null;
  extractionScheduler = null;
  verificationScheduler = null;
  extractionEvents = null;
  verificationEvents = null;
};

module.exports = {
  getQueues,
  addExtractionJob,
  addVerificationJob,
  getJobStats,
  closeQueues,
  extractionQueueName,
  verificationQueueName,
};
