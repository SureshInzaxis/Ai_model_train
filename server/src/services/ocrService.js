const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const PDFService = require('./pdfService');
const logger = require('../config/logger');

class OCRService {
  constructor() {
    this.worker = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.worker = await Tesseract.createWorker({
        logger: (m) => logger.debug('Tesseract:', m),
        errorHandler: (e) => logger.error('Tesseract error:', e),
      });

      await this.worker.load();
      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng');
      this.initialized = true;
      logger.info('OCR service initialized with Tesseract');
    } catch (error) {
      logger.error('Failed to initialize OCR service:', error.message);
      this.initialized = false;
      throw error;
    }
  }

  async ocrImage(imagePath, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const result = await this.worker.recognize(imagePath, 'eng', {
      tessedit_pageseg_mode: 'auto',
      tessedit_char_whitelist: options.charWhitelist || undefined,
      preserve_interword_formfeeds: true,
      ...options,
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words,
    };
  }

  async ocrBuffer(imageBuffer, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const result = await this.worker.recognize(imageBuffer, 'eng', {
      tessedit_pageseg_mode: 'auto',
      ...options,
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words,
    };
  }

  async processScannedPDF(pdfPath, outputDir, totalPages) {
    const results = [];
    const maxPages = totalPages || await PDFService.getPageCount(pdfPath);

    for (let i = 1; i <= maxPages; i++) {
      try {
        const imagePath = path.join(outputDir, `page_${i}.png`);
        await PDFService.renderPageWithPdf2pic(pdfPath, i, imagePath);

        const ocrResult = await this.ocrImage(imagePath, {
          tessedit_pageseg_mode: 'auto',
        });

        results.push({
          pageNumber: i,
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          warnings: this.extractWarnings(ocrResult),
        });

        logger.info(`OCR completed for page ${i} (confidence: ${ocrResult.confidence})`);
      } catch (error) {
        logger.error(`OCR failed for page ${i}:`, error.message);
        results.push({
          pageNumber: i,
          text: '',
          confidence: 0,
          error: error.message,
          needsReview: true,
        });
      }
    }

    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;

    return {
      pages: results,
      averageConfidence: avgConfidence,
      totalPages: maxPages,
      isScanned: avgConfidence < 60 || results.some(r => r.confidence === 0),
    };
  }

  extractWarnings(ocrResult) {
    const warnings = [];
    if (!ocrResult.text || ocrResult.text.trim().length === 0) {
      warnings.push('No text extracted from this page');
    }
    if (ocrResult.confidence < 50) {
      warnings.push(`Low OCR confidence: ${Math.round(ocrResult.confidence)}%`);
    }
    const specialChars = ocrResult.text.match(/[^\x00-\x7F\s]/g);
    if (specialChars && specialChars.length > ocrResult.text.length * 0.1) {
      warnings.push('High ratio of special characters detected - possible OCR errors');
    }
    return warnings;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }
}

module.exports = new OCRService();
