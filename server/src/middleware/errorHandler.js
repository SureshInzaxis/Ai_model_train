const logger = require('../config/logger');

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack || err.message, {
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    query: req.query,
    ip: req.ip,
  });

  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err.isOperational || statusCode < 500;

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && !isOperational && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
