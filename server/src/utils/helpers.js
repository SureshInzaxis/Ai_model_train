const crypto = require('crypto');

const generateStableId = () => crypto.randomUUID();

const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\f/g, ' ')
    .trim();
};

const extractPageRange = (text) => {
  if (!text) return null;
  const match = text.match(/(?:Page|page)\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

const estimateReadingTime = (textLength) => {
  const wordsPerMinute = 200;
  const minutes = Math.floor(textLength / (wordsPerMinute * 5));
  return Math.max(1, minutes);
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const buildError = (statusCode, message, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  if (details) error.details = details;
  return error;
};

module.exports = {
  generateStableId,
  sanitizeText,
  extractPageRange,
  estimateReadingTime,
  formatFileSize,
  buildError,
};
