module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: { msg: 'Username already exists' } },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: { msg: 'Email already exists' } },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    full_name: { type: DataTypes.STRING(100), allowNull: false },
    role: {
      type: DataTypes.ENUM('admin', 'reviewer', 'viewer'),
      defaultValue: 'reviewer',
    },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'users',
    indexes: [
      { fields: ['username'] },
      { fields: ['email'] },
      { fields: ['role'] },
    ],
  });

  return User;
};
