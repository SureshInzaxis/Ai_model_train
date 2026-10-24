module.exports = (sequelize, DataTypes) => {
  const PDFDocument = sequelize.define('PDFDocument', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    stored_filename: { type: DataTypes.STRING(255), allowNull: false, unique: { msg: 'Stored filename already exists' } },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_hash: { type: DataTypes.STRING(64), allowNull: false, unique: { msg: 'File hash already exists - duplicate detected' } },
    file_size: { type: DataTypes.INTEGER, allowNull: false },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    chapter_id: { type: DataTypes.INTEGER, allowNull: true },
    exam_year: { type: DataTypes.INTEGER, allowNull: true },
    exam_type: { type: DataTypes.STRING(50), allowNull: true },
    source: { type: DataTypes.STRING(255), allowNull: true },
    page_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    question_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    ocr_required: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: {
      type: DataTypes.ENUM('uploaded', 'processing', 'processed', 'failed'),
      defaultValue: 'uploaded',
    },
    ocr_confidence: { type: DataTypes.FLOAT, allowNull: true },
    extraction_warnings: { type: DataTypes.TEXT, allowNull: true },
    uploaded_at: { type: DataTypes.DATE, defaultValue: new Date() },
  }, {
    tableName: 'pdf_documents',
    indexes: [
      { fields: ['subject_id'] },
      { fields: ['chapter_id'] },
      { fields: ['exam_year'] },
      { fields: ['exam_type'] },
      { fields: ['status'] },
      { fields: ['file_hash'], unique: true },
      { fields: ['created_at'] },
    ],
  });

  return PDFDocument;
};
