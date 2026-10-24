const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const logger = require('../config/logger');

class PDFService {
  static async extractText(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer, {
        max: 0,
        normalizeWhitespace: true,
      });

      return {
        text: pdfData.text,
        numPages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata,
        textLength: pdfData.text.length,
      };
    } catch (error) {
      logger.error('PDF text extraction failed:', error.message);
      throw error;
    }
  }

  static async extractTextByPage(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer, {
        max: 0,
        normalizeWhitespace: true,
      });

      const pages = [];
      const textByPage = pdfData.text.split(/\f/);
      for (let i = 0; i < pdfData.numpages; i++) {
        pages.push({
          pageNumber: i + 1,
          text: textByPage[i] || '',
        });
      }

      return { pages, numPages: pdfData.numpages, info: pdfData.info };
    } catch (error) {
      logger.error('PDF page-by-page extraction failed:', error.message);
      throw error;
    }
  }

  static async renderPageToImage(filePath, pageNumber = 1) {
    try {
      const { fromPath } = require('pdf2pic');
      const outputDir = path.join(path.dirname(filePath), 'page_cache');
      const options = {
        density: 150,
        saveFilename: `page_${pageNumber}`,
        savePath: outputDir,
        format: 'png',
        width: 1024,
        height: 1024,
        quality: 50,
      };

      const convert = fromPath(filePath, options);
      const result = await convert(pageNumber - 1);
      return result.path;
    } catch (error) {
      logger.error(`Failed to render page ${pageNumber}:`, error.message);
      throw error;
    }
  }

  static async renderPageWithPdf2pic(filePath, pageNumber, outputPath) {
    try {
      const { fromPath } = require('pdf2pic');
      const outputDir = path.dirname(outputPath);
      const outputName = path.basename(outputPath, path.extname(outputPath));
      const options = {
        density: 150,
        saveFilename: outputName,
        savePath: outputDir,
        format: 'png',
        width: 1024,
        height: 1024,
      };

      const convert = fromPath(filePath, options);
      const result = await convert(pageNumber - 1);
      return result.path;
    } catch (error) {
      logger.error(`pdf2pic render failed for page ${pageNumber}:`, error.message);
      throw error;
    }
  }

  static async getPageCount(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.numpages;
    } catch (error) {
      logger.error('Failed to get page count:', error.message);
      throw error;
    }
  }

  static detectScannedPdf(text, numPages) {
    if (!text || text.length === 0) return true;
    const charsPerPage = text.length / (numPages || 1);
    return charsPerPage < 50;
  }
}

module.exports = PDFService;
