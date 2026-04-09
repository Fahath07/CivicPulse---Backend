const { Op } = require('sequelize');
const { Issue, User, StatusHistory, Notification } = require('../models');

exports.getStats = async (req, res) => {
  try {
    const total = await Issue.count();
    const open = await Issue.count({ where: { status: 'Open' } });
    const inProgress = await Issue.count({ where: { status: 'In Progress' } });
    const resolved = await Issue.count({ where: { status: 'Resolved' } });
    const critical = await Issue.count({ where: { priority: 'Critical', status: { [Op.notIn]: ['Resolved', 'Closed'] } } });
    const slaBreached = await Issue.count({
      where: { status: { [Op.notIn]: ['Resolved', 'Closed'] }, slaDeadline: { [Op.lt]: new Date() } },
    });

    const resolvedIssues = await Issue.findAll({
      where: { status: 'Resolved', resolvedAt: { [Op.ne]: null } },
      attributes: ['createdAt', 'resolvedAt'],
    });
    let avgDays = 0;
    if (resolvedIssues.length) {
      const total = resolvedIssues.reduce((sum, i) => {
        return sum + (new Date(i.resolvedAt) - new Date(i.createdAt));
      }, 0);
      avgDays = Math.round(total / resolvedIssues.length / 86400000);
    }

    const wards = await Issue.findAll({
      attributes: ['ward', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['ward'],
      order: [[require('sequelize').literal('count'), 'DESC']],
      limit: 3,
      raw: true,
    });

    const byCategory = await Issue.findAll({
      attributes: ['category', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['category'],
      raw: true,
    });

    const byDept = await Issue.findAll({
      attributes: ['department', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['department'],
      raw: true,
    });

    const activeWards = await Issue.count({ col: 'ward', distinct: true });

    res.json({ total, open, inProgress, resolved, critical, slaBreached, avgDays, wards, byCategory, byDept, activeWards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getIssues = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, priority, ward, from, to, assigned } = req.query;
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (ward) where.ward = { [Op.iLike]: `%${ward}%` };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    if (assigned === 'true') where.assignedToId = { [Op.ne]: null };
    if (assigned === 'false') where.assignedToId = null;

    const { count, rows } = await Issue.findAndCountAll({
      where,
      include: [
        { model: User, as: 'reporter', attributes: ['name', 'ward'] },
        { model: User, as: 'assignedTo', attributes: ['name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({ issues: rows, total: count, pages: Math.ceil(count / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.bulkUpdate = async (req, res) => {
  try {
    const { ids, action, assignedToId } = req.body;
    const io = req.app.get('io');

    if (action === 'assign' && assignedToId) {
      await Issue.update({ assignedToId, status: 'Assigned' }, { where: { id: ids } });
      for (const id of ids) {
        await StatusHistory.create({ issueId: id, changedBy: req.user.id, fromStatus: null, toStatus: 'Assigned' });
        const issue = await Issue.findByPk(id);
        await Notification.create({
          userId: assignedToId,
          message: `You have been assigned issue: "${issue.title}"`,
          type: 'issue_assigned',
          issueId: id,
        });
        io.to(`user:${assignedToId}`).emit('issue:assigned', { issue });
      }
    } else if (action === 'resolve') {
      await Issue.update({ status: 'Resolved', resolvedAt: new Date() }, { where: { id: ids } });
    } else if (action === 'close') {
      await Issue.update({ status: 'Closed' }, { where: { id: ids } });
    } else if (action === 'escalate') {
      await Issue.update({ priority: 'Critical' }, { where: { id: ids } });
    }

    res.json({ message: 'Bulk update successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getFieldWorkers = async (req, res) => {
  try {
    const workers = await User.findAll({
      where: { role: 'fieldworker' },
      attributes: ['id', 'name', 'ward', 'email', 'createdAt'],
    });
    res.json({ workers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createFieldWorker = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { name, email, phone, ward, password, department } = req.body;
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const worker = await User.create({ name, email, phone, ward, password: hashed, role: 'fieldworker' });
    const { password: _, ...data } = worker.toJSON();
    res.status(201).json({ worker: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteFieldWorker = async (req, res) => {
  try {
    const worker = await User.findOne({ where: { id: req.params.id, role: 'fieldworker' } });
    if (!worker) return res.status(404).json({ message: 'Field worker not found' });
    await worker.destroy();
    res.json({ message: 'Field worker deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.assign = async (req, res) => {
  try {
    const { issueId, workerId } = req.body;
    const issue = await Issue.findByPk(issueId);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    await issue.update({ assignedToId: workerId, status: 'Assigned' });
    await StatusHistory.create({
      issueId, changedBy: req.user.id, fromStatus: issue.status, toStatus: 'Assigned',
    });
    const worker = await User.findByPk(workerId);
    await Notification.create({
      userId: workerId,
      message: `You have been assigned issue: "${issue.title}"`,
      type: 'issue_assigned',
      issueId,
    });
    const io = req.app.get('io');
    io.to(`user:${workerId}`).emit('issue:assigned', { issue });
    res.json({ issue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
