module.exports = (sequelize, DataTypes) => {
  const Subject = sequelize.define('Subject', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: { msg: 'Subject name already exists' } },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: { msg: 'Subject code already exists' } },
    description: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    tableName: 'subjects',
  });

  return Subject;
};
