const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const hash = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${hash}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    logger.warn(`Rejected non-PDF file upload: ${file.mimetype}`);
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    files: parseInt(process.env.MAX_FILES_PER_BATCH || '10', 10),
  },
  fileFilter,
});

module.exports = { upload, storage };
