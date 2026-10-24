module.exports = (sequelize, DataTypes) => {
  const Chapter = sequelize.define('Chapter', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    tableName: 'chapters',
    indexes: [
      { fields: ['subject_id'] },
      { fields: ['subject_id', 'name'], unique: true, name: 'chapters_subject_name_unique' },
    ],
  });

  return Chapter;
};
