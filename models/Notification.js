const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  message: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING },
  issueId: { type: DataTypes.UUID },
  userId: { type: DataTypes.UUID, allowNull: false },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: true });

module.exports = Notification;
