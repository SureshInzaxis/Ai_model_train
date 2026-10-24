module.exports = (sequelize, DataTypes) => {
  const CorrectedQuestion = sequelize.define('CorrectedQuestion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    source_question_id: { type: DataTypes.INTEGER, allowNull: true },
    extracted_question_id: { type: DataTypes.INTEGER, allowNull: true },
    pdf_document_id: { type: DataTypes.INTEGER, allowNull: true },
    question_number: { type: DataTypes.STRING(50), allowNull: true },
    subject_id: { type: DataTypes.INTEGER, allowNull: true },
    chapter_id: { type: DataTypes.INTEGER, allowNull: true },
    subject_name: { type: DataTypes.STRING(100), allowNull: true },
    chapter_name: { type: DataTypes.STRING(150), allowNull: true },
    exam_year: { type: DataTypes.INTEGER, allowNull: true },
    exam_type: { type: DataTypes.STRING(50), allowNull: true },

    db_question_text: { type: DataTypes.TEXT, allowNull: true },
    db_option_a: { type: DataTypes.TEXT, allowNull: true },
    db_option_b: { type: DataTypes.TEXT, allowNull: true },
    db_option_c: { type: DataTypes.TEXT, allowNull: true },
    db_option_d: { type: DataTypes.TEXT, allowNull: true },
    db_answer_key: { type: DataTypes.STRING(10), allowNull: true },
    db_explanation: { type: DataTypes.TEXT, allowNull: true },

    pdf_question_text: { type: DataTypes.TEXT, allowNull: true },
    pdf_option_a: { type: DataTypes.TEXT, allowNull: true },
    pdf_option_b: { type: DataTypes.TEXT, allowNull: true },
    pdf_option_c: { type: DataTypes.TEXT, allowNull: true },
    pdf_option_d: { type: DataTypes.TEXT, allowNull: true },
    pdf_answer_key: { type: DataTypes.STRING(10), allowNull: true },
    pdf_explanation: { type: DataTypes.TEXT, allowNull: true },

    question_text: { type: DataTypes.TEXT, allowNull: false },
    option_a: { type: DataTypes.TEXT, allowNull: true },
    option_b: { type: DataTypes.TEXT, allowNull: true },
    option_c: { type: DataTypes.TEXT, allowNull: true },
    option_d: { type: DataTypes.TEXT, allowNull: true },
    options_json: { type: DataTypes.JSON, allowNull: true },
    answer_key: { type: DataTypes.STRING(10), allowNull: true },
    explanation: { type: DataTypes.TEXT, allowNull: true },

    match_status: {
      type: DataTypes.ENUM('matched', 'unmatched', 'conflict'),
      defaultValue: 'unmatched',
    },
    match_similarity: { type: DataTypes.FLOAT, allowNull: true },
    issue_type: {
      type: DataTypes.ENUM(
        'correct',
        'wrong_answer',
        'wrong_explanation',
        'wrong_question',
        'wrong_options',
        'answer_conflict',
        'needs_review'
      ),
      allowNull: true,
    },
    ai_confidence: { type: DataTypes.FLOAT, allowNull: true },
    ai_reason: { type: DataTypes.TEXT, allowNull: true },
    ai_status: {
      type: DataTypes.ENUM('pending', 'running', 'done', 'failed'),
      defaultValue: 'pending',
    },
    ai_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    review_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'edited'),
      defaultValue: 'pending',
    },
    needs_human_review: { type: DataTypes.BOOLEAN, defaultValue: true },
    stored_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'corrected_questions',
    indexes: [
      { fields: ['pdf_document_id'] },
      { fields: ['source_question_id'] },
      { fields: ['extracted_question_id'] },
      { fields: ['subject_id'] },
      { fields: ['chapter_id'] },
      { fields: ['match_status'] },
      { fields: ['review_status'] },
      { fields: ['issue_type'] },
      { fields: ['ai_status'] },
      {
        unique: true,
        fields: ['pdf_document_id', 'extracted_question_id'],
        name: 'corrected_pdf_extracted_unique',
      },
    ],
  });

  return CorrectedQuestion;
};
