const { sequelize } = require('../config/database');
const logger = require('../config/logger');

let trigramReady = false;

const ensureTrigramIndex = async () => {
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS questions_question_text_trgm
      ON questions USING gin (question_text gin_trgm_ops);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS questions_bank_lookup
      ON questions (subject_id)
      WHERE pdf_document_id IS NULL;
    `);
    trigramReady = true;
    logger.info('PostgreSQL trigram search index is ready for the 50k question bank');
  } catch (error) {
    trigramReady = false;
    logger.warn(`Could not enable pg_trgm (keyword fallback will be used): ${error.message}`);
  }
  return trigramReady;
};

const isTrigramReady = () => trigramReady;

module.exports = { ensureTrigramIndex, isTrigramReady };
