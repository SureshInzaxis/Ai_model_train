const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const logger = require('./src/config/logger');
const { testConnection } = require('./src/config/database');
const { sequelize, syncModels } = require('./src/models');
const { seedDatabase } = require('./src/services/seedService');
const { ensureTrigramIndex } = require('./src/services/searchIndex');
const chapterLookup = require('./src/services/chapterLookupService');
const app = require('./src/app');
const redis = require('./src/config/redis');
const queueManager = require('./src/jobs/queueManager');

const PORT = process.env.PORT || 5000;
let server = null;

const bootstrap = async () => {
  logger.info('Starting AI-Powered Exam Question Analyzer server...');

  logger.info('Checking PostgreSQL connection...');
  const dbConnected = await testConnection();

  if (dbConnected) {
    logger.info('Synchronizing database models...');
    const force = process.env.NODE_ENV === 'development' && process.env.DB_FORCE_SYNC === 'true';
    await syncModels(force);

    logger.info('Seeding default subjects and chapters...');
    await seedDatabase();
    await ensureTrigramIndex();
    await chapterLookup.load();
    logger.info('Database ready');
  } else {
    logger.warn('PostgreSQL connection failed. Application will start but DB features will be unavailable.');
  }

  logger.info('Checking Redis connection...');
  try {
    const ping = await redis.connection.ping();
    if (ping === 'PONG') {
      logger.info('Redis connection established');
      await queueManager.getQueues();
    }
  } catch (redisErr) {
    logger.warn(`Redis connection failed: ${redisErr.message}. Job queues will not be available.`);
  }

  logger.info('Checking Ollama connection...');
  const ollama = require('./src/config/ollama');
  const ollamaStatus = await ollama.isAvailable();
  if (ollamaStatus.available) {
    logger.info(`Ollama connected. Available models: ${ollamaStatus.models.map(m => m.name).join(', ')}`);
    const modelExists = await ollama.checkModelExists();
    if (modelExists) {
      logger.info(`Configured model '${ollama.model}' is available`);
    } else {
      logger.warn(`Configured model '${ollama.model}' not found in Ollama. Available: ${ollamaStatus.models.map(m => m.name).join(', ')}`);
    }
  } else {
    logger.warn(`Ollama not available: ${ollamaStatus.error}. AI verification will be disabled.`);
  }

  server = app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    logger.info(`API URL: http://localhost:${PORT}/api`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    if (server) server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    if (server) server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
};

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
