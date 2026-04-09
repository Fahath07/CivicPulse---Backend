const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatusHistory = sequelize.define('StatusHistory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  issueId: { type: DataTypes.UUID, allowNull: false },
  changedBy: { type: DataTypes.UUID },
  fromStatus: { type: DataTypes.STRING },
  toStatus: { type: DataTypes.STRING },
  note: { type: DataTypes.TEXT },
}, { timestamps: true });

module.exports = StatusHistory;
