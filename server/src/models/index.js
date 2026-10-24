const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

const Subject = require('./Subject')(sequelize, Sequelize.DataTypes);
const Chapter = require('./Chapter')(sequelize, Sequelize.DataTypes);
const PDFDocument = require('./PDFDocument')(sequelize, Sequelize.DataTypes);
const Question = require('./Question')(sequelize, Sequelize.DataTypes);
const ProcessingJob = require('./ProcessingJob')(sequelize, Sequelize.DataTypes);
const VerificationResult = require('./VerificationResult')(sequelize, Sequelize.DataTypes);
const ReviewHistory = require('./ReviewHistory')(sequelize, Sequelize.DataTypes);
const ImportJob = require('./ImportJob')(sequelize, Sequelize.DataTypes);
const User = require('./User')(sequelize, Sequelize.DataTypes);
const CorrectedQuestion = require('./CorrectedQuestion')(sequelize, Sequelize.DataTypes);

Subject.hasMany(Chapter, { foreignKey: 'subject_id', as: 'chapters' });
Chapter.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

Subject.hasMany(PDFDocument, { foreignKey: 'subject_id', as: 'pdf_documents' });
PDFDocument.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

Chapter.hasMany(PDFDocument, { foreignKey: 'chapter_id', as: 'pdf_documents' });
PDFDocument.belongsTo(Chapter, { foreignKey: 'chapter_id', as: 'chapter' });

PDFDocument.hasMany(Question, { foreignKey: 'pdf_document_id', as: 'questions' });
Question.belongsTo(PDFDocument, { foreignKey: 'pdf_document_id', as: 'pdf_document' });

Subject.hasMany(Question, { foreignKey: 'subject_id', as: 'questions' });
Question.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

Chapter.hasMany(Question, { foreignKey: 'chapter_id', as: 'questions' });
Question.belongsTo(Chapter, { foreignKey: 'chapter_id', as: 'chapter' });

Question.hasMany(VerificationResult, { foreignKey: 'question_id', as: 'verification_results', onDelete: 'CASCADE' });
VerificationResult.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

Question.hasMany(ReviewHistory, { foreignKey: 'question_id', as: 'review_history', onDelete: 'CASCADE' });
ReviewHistory.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

User.hasMany(ReviewHistory, { foreignKey: 'reviewer_id', as: 'reviews' });
ReviewHistory.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer', allowNull: true });

ProcessingJob.belongsTo(PDFDocument, { foreignKey: 'pdf_document_id', as: 'pdf_document', allowNull: true });

Question.hasMany(CorrectedQuestion, { foreignKey: 'source_question_id', as: 'corrections' });
CorrectedQuestion.belongsTo(Question, { foreignKey: 'source_question_id', as: 'source_question' });
CorrectedQuestion.belongsTo(Question, { foreignKey: 'extracted_question_id', as: 'extracted_question' });
PDFDocument.hasMany(CorrectedQuestion, { foreignKey: 'pdf_document_id', as: 'corrected_questions' });
CorrectedQuestion.belongsTo(PDFDocument, { foreignKey: 'pdf_document_id', as: 'pdf_document' });
Subject.hasMany(CorrectedQuestion, { foreignKey: 'subject_id', as: 'corrected_questions' });
CorrectedQuestion.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });
Chapter.hasMany(CorrectedQuestion, { foreignKey: 'chapter_id', as: 'corrected_questions' });
CorrectedQuestion.belongsTo(Chapter, { foreignKey: 'chapter_id', as: 'chapter' });

const syncModels = async (force = false) => {
  try {
    await sequelize.sync({ force });
    logger.info('Database models synchronized');
  } catch (error) {
    logger.error('Failed to synchronize models:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  Subject,
  Chapter,
  PDFDocument,
  Question,
  ProcessingJob,
  VerificationResult,
  ReviewHistory,
  ImportJob,
  User,
  CorrectedQuestion,
  syncModels,
};
