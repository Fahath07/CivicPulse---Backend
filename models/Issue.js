const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Issue = sequelize.define('Issue', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  category: {
    type: DataTypes.ENUM('Roads', 'Water', 'Electricity', 'Sanitation', 'Parks', 'Drainage', 'Construction', 'Other'),
    allowNull: false,
  },
  priority: { type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'), defaultValue: 'Medium' },
  status: {
    type: DataTypes.ENUM('Open', 'Assigned', 'In Progress', 'Pending Verification', 'Resolved', 'Closed', 'Reopened'),
    defaultValue: 'Open',
  },
  latitude: { type: DataTypes.FLOAT },
  longitude: { type: DataTypes.FLOAT },
  address: { type: DataTypes.STRING },
  ward: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  photos: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  resolutionPhotos: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  resolutionNote: { type: DataTypes.TEXT },
  voteCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  slaDeadline: { type: DataTypes.DATE },
  resolvedAt: { type: DataTypes.DATE },
  citizenVerified: { type: DataTypes.BOOLEAN, defaultValue: null },
  citizenFeedback: { type: DataTypes.TEXT },
  citizenVerifiedAt: { type: DataTypes.DATE },
  reporterId: { type: DataTypes.UUID },
  assignedToId: { type: DataTypes.UUID },
}, { timestamps: true });

module.exports = Issue;
