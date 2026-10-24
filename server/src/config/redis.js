const IORedis = require('ioredis');
const logger = require('./logger');

let connection = null;

const createRedisConnection = () => {
  if (connection) {
    return connection;
  }

  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop reconnecting after 3 tries if Redis is not running
      }
      return Math.min(times * 1000, 3000);
    },
  };

  if (process.env.REDIS_PASSWORD) {
    redisConfig.password = process.env.REDIS_PASSWORD;
  }

  connection = new IORedis(redisConfig);

  connection.on('error', (err) => {
    logger.warn('Redis connection error:', err.message);
  });

  connection.on('connect', () => {
    logger.info('Redis connection established');
  });

  connection.on('reconnecting', (delay) => {
    logger.info(`Redis reconnecting in ${delay}ms`);
  });

  return connection;
};

const getRedisConnection = () => {
  if (!connection) {
    return createRedisConnection();
  }
  return connection;
};

const disconnectRedis = async () => {
  if (connection) {
    await connection.quit();
    connection = null;
    logger.info('Redis connection closed');
  }
};

module.exports = {
  createRedisConnection,
  getRedisConnection,
  disconnectRedis,
  get connection() {
    return getRedisConnection();
  },
};
