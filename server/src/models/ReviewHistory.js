module.exports = (sequelize, DataTypes) => {
  const ReviewHistory = sequelize.define('ReviewHistory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    action: {
      type: DataTypes.ENUM('approve', 'reject', 'edit', 'comment'),
      allowNull: false,
    },
    reviewer_id: { type: DataTypes.INTEGER, allowNull: true },
    reviewer_name: { type: DataTypes.STRING(100), allowNull: false },
    previous_answer: { type: DataTypes.STRING(10), allowNull: true },
    new_answer: { type: DataTypes.STRING(10), allowNull: true },
    previous_explanation: { type: DataTypes.TEXT, allowNull: true },
    new_explanation: { type: DataTypes.TEXT, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'review_history',
    indexes: [
      { fields: ['question_id'] },
      { fields: ['reviewer_id'] },
      { fields: ['action'] },
      { fields: ['created_at'] },
    ],
  });

  return ReviewHistory;
};
