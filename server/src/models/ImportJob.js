module.exports = (sequelize, DataTypes) => {
  const ImportJob = sequelize.define('ImportJob', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    import_type: {
      type: DataTypes.ENUM('csv', 'excel', 'json'),
      allowNull: false,
    },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    total_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    processed_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    success_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    duplicate_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    error_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    errors: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'import_jobs',
    indexes: [
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  });

  return ImportJob;
};
