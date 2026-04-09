const sequelize = require('../config/database');
const User = require('./User');
const Issue = require('./Issue');
const Comment = require('./Comment');
const Vote = require('./Vote');
const Notification = require('./Notification');
const StatusHistory = require('./StatusHistory');

User.hasMany(Issue, { foreignKey: 'reporterId', as: 'reportedIssues' });
User.hasMany(Issue, { foreignKey: 'assignedToId', as: 'assignedIssues' });
User.hasMany(Comment, { foreignKey: 'userId' });
User.hasMany(Vote, { foreignKey: 'userId' });
User.hasMany(Notification, { foreignKey: 'userId' });

Issue.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });
Issue.belongsTo(User, { foreignKey: 'assignedToId', as: 'assignedTo' });
Issue.hasMany(Comment, { foreignKey: 'issueId' });
Issue.hasMany(Vote, { foreignKey: 'issueId' });
Issue.hasMany(StatusHistory, { foreignKey: 'issueId' });

Comment.belongsTo(User, { foreignKey: 'userId' });
Comment.belongsTo(Issue, { foreignKey: 'issueId' });

Vote.belongsTo(User, { foreignKey: 'userId' });
Vote.belongsTo(Issue, { foreignKey: 'issueId' });

module.exports = { sequelize, User, Issue, Comment, Vote, Notification, StatusHistory };
