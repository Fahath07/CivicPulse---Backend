const { Op } = require('sequelize');
const { Issue } = require('../models');

let io;

const slaChecker = async () => {
  try {
    if (!io) return;
    const breached = await Issue.findAll({
      where: {
        status: { [Op.notIn]: ['Resolved', 'Closed'] },
        slaDeadline: { [Op.lt]: new Date() },
      },
    });
    for (const issue of breached) {
      io.to('admin').emit('sla:breach', { issueId: issue.id, title: issue.title, ward: issue.ward });
    }
  } catch (err) {
    console.error('SLA checker error:', err.message);
  }
};

slaChecker.setIo = (socketIo) => { io = socketIo; };

module.exports = slaChecker;
