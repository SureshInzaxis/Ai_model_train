module.exports = (sequelize, DataTypes) => {
  const ProcessingJob = sequelize.define('ProcessingJob', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    job_type: {
      type: DataTypes.ENUM('extraction', 'verification'),
      allowNull: false,
    },
    pdf_document_id: { type: DataTypes.INTEGER, allowNull: true },
    question_ids: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'paused'),
      defaultValue: 'pending',
    },
    progress: { type: DataTypes.FLOAT, defaultValue: 0 },
    total_items: { type: DataTypes.INTEGER, defaultValue: 0 },
    processed_items: { type: DataTypes.INTEGER, defaultValue: 0 },
    failed_items: { type: DataTypes.INTEGER, defaultValue: 0 },
    concurrency: { type: DataTypes.INTEGER, defaultValue: 2 },
    batch_size: { type: DataTypes.INTEGER, defaultValue: 10 },
    configuration: { type: DataTypes.JSON, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    result: { type: DataTypes.JSON, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.STRING(100), allowNull: true },
  }, {
    tableName: 'processing_jobs',
    indexes: [
      { fields: ['job_type'] },
      { fields: ['status'] },
      { fields: ['pdf_document_id'] },
      { fields: ['created_at'] },
    ],
  });

  return ProcessingJob;
};
