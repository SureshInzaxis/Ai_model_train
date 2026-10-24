const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const extractImageUrls = (...texts) => {
  const urls = [];
  const patterns = [
    /!\[[^\]]*\]\(([^)\s]+)\)/g,
    /<img[^>]+src=["']([^"']+)["']/gi,
  ];
  texts.filter(Boolean).forEach((text) => {
    const value = String(text);
    patterns.forEach((pattern) => {
      const re = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = re.exec(value)) !== null) {
        if (match[1]) urls.push(match[1].trim());
      }
    });
  });
  return [...new Set(urls)];
};

const localPathFromUrl = (url) => {
  try {
    const parsed = new URL(url, 'http://localhost:5000');
    const pathname = decodeURIComponent(parsed.pathname || '');
    const marker = '/api/pdfs/diagrams/';
    if (pathname.includes('/diagrams/')) {
      const file = pathname.split('/diagrams/')[1];
      if (file) {
        return path.resolve(__dirname, '../../uploads/diagrams', file);
      }
    }
    if (pathname.startsWith('/uploads/')) {
      return path.resolve(__dirname, '../..', pathname.replace(/^\//, ''));
    }
  } catch {
    // ignore
  }
  if (url.startsWith('/') && !url.startsWith('//')) {
    return path.resolve(__dirname, '../..', url.replace(/^\//, ''));
  }
  return null;
};

const fetchImageBase64 = async (url) => {
  const local = localPathFromUrl(url);
  if (local && fs.existsSync(local)) {
    return fs.readFileSync(local).toString('base64');
  }
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 8 * 1024 * 1024,
    });
    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    logger.warn(`Could not load diagram ${url}: ${error.message}`);
    return null;
  }
};

const collectDiagramImages = async (...texts) => {
  const urls = extractImageUrls(...texts);
  const images = [];
  for (const url of urls.slice(0, 4)) {
    const base64 = await fetchImageBase64(url);
    if (base64) images.push(base64);
  }
  return { urls, images };
};

module.exports = {
  extractImageUrls,
  collectDiagramImages,
};
