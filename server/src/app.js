const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const logger = require('./config/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.get('/', (req, res) => {
  res.json({
    name: 'AI-Powered Exam Question Analyzer',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/health', require('./routes/health'));
app.use('/api/pdfs', require('./routes/pdf'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/import', require('./routes/import'));
app.use('/api/export', require('./routes/export'));
app.use('/api/corrected', require('./routes/corrected'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
