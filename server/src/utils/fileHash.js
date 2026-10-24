const crypto = require('crypto');
const fs = require('fs').promises;

const computeFileHash = async (filePath) => {
  const hash = crypto.createHash('sha256');
  const stream = require('fs').createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

const computeBufferHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

module.exports = { computeFileHash, computeBufferHash };
