const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('citizen', 'admin', 'fieldworker'), defaultValue: 'citizen' },
  ward: { type: DataTypes.STRING },
  trustScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  badge: { type: DataTypes.ENUM('Bronze', 'Silver', 'Gold', 'Platinum'), defaultValue: 'Bronze' },
  notifInApp: { type: DataTypes.BOOLEAN, defaultValue: true },
  avatarUrl: { type: DataTypes.STRING },
}, { timestamps: true });

module.exports = User;
