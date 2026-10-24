module.exports = (sequelize, DataTypes) => {
  const VerificationResult = sequelize.define('VerificationResult', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    model_used: { type: DataTypes.STRING(100), allowNull: false },
    suggested_answer: { type: DataTypes.STRING(10), allowNull: true },
    answer_matches: { type: DataTypes.BOOLEAN, allowNull: true },
    issue_type: {
      type: DataTypes.ENUM(
        'correct',
        'possible_key_error',
        'incorrect_explanation',
        'ambiguous_question',
        'missing_info',
        'extraction_error',
        'needs_review',
      ),
      allowNull: true,
    },
    confidence: { type: DataTypes.INTEGER, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    suggested_explanation: { type: DataTypes.TEXT, allowNull: true },
    needs_human_review: { type: DataTypes.BOOLEAN, defaultValue: false },
    raw_response: { type: DataTypes.TEXT, allowNull: true },
    prompt_used: { type: DataTypes.TEXT, allowNull: true },
    eval_count: { type: DataTypes.INTEGER, allowNull: true },
    eval_duration_ms: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'verification_results',
    indexes: [
      { fields: ['question_id'] },
      { fields: ['issue_type'] },
      { fields: ['needs_human_review'] },
      { fields: ['created_at'] },
    ],
  });

  return VerificationResult;
};
