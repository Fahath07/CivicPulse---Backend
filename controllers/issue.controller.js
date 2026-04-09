const { Op } = require('sequelize');
const { Issue, User, Comment, Vote, Notification, StatusHistory } = require('../models');

const SLA_DAYS = { Critical: 2, High: 5, Medium: 7, Low: 14 };

const updateTrustScore = async (userId, delta, io) => {
  const user = await User.findByPk(userId);
  if (!user) return;
  const newScore = Math.max(0, user.trustScore + delta);
  let badge = 'Bronze';
  if (newScore > 90) badge = 'Platinum';
  else if (newScore > 60) badge = 'Gold';
  else if (newScore > 30) badge = 'Silver';
  await user.update({ trustScore: newScore, badge });
  if (io) io.to(`user:${userId}`).emit('trust:updated', { trustScore: newScore, badge });
};

exports.getPublic = async (req, res) => {
  try {
    const issues = await Issue.findAll({
      include: [{ model: User, as: 'reporter', attributes: ['name', 'ward'] }],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ issues });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMy = async (req, res) => {
  try {
    const issues = await Issue.findAll({
      where: { reporterId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ issues });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAssigned = async (req, res) => {
  try {
    const issues = await Issue.findAll({
      where: { assignedToId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ issues });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.checkDuplicate = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ match: null });
    const issue = await Issue.findOne({
      where: {
        title: { [Op.iLike]: `%${q}%` },
        status: { [Op.notIn]: ['Resolved', 'Closed'] },
      },
    });
    res.json({ match: issue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const issue = await Issue.findByPk(req.params.id, {
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'name', 'ward', 'badge'] },
        { model: User, as: 'assignedTo', attributes: ['id', 'name', 'ward'] },
        { model: StatusHistory, order: [['createdAt', 'ASC']] },
      ],
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json({ issue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, description, category, priority, latitude, longitude, address, ward, department } = req.body;
    const photos = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + (SLA_DAYS[priority] || 7));

    const issue = await Issue.create({
      title, description, category, priority, latitude, longitude,
      address, ward, department, photos, slaDeadline, reporterId: req.user.id,
    });

    await StatusHistory.create({
      issueId: issue.id, changedBy: req.user.id, fromStatus: null, toStatus: 'Open', note: 'Issue reported',
    });

    await updateTrustScore(req.user.id, 5, req.app.get('io'));

    const io = req.app.get('io');
    io.to('admin').emit('issue:new', { issue, ward: issue.ward });

    await Notification.create({
      userId: req.user.id,
      message: `Your issue "${title}" has been submitted successfully.`,
      type: 'issue_created',
      issueId: issue.id,
    });

    res.status(201).json({ issue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, note, resolutionNote } = req.body;
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const fromStatus = issue.status;

    // Field worker marking resolved → set to Pending Verification instead
    const newStatus = (status === 'Resolved' && req.user.role === 'fieldworker')
      ? 'Pending Verification'
      : status;

    const updates = { status: newStatus };

    if (status === 'Resolved' || newStatus === 'Pending Verification') {
      if (resolutionNote) updates.resolutionNote = resolutionNote;
      if (req.files?.length) updates.resolutionPhotos = req.files.map(f => `/uploads/${f.filename}`);
    }

    await issue.update(updates);
    await StatusHistory.create({
      issueId: issue.id, changedBy: req.user.id, fromStatus, toStatus: newStatus, note,
    });

    const io = req.app.get('io');

    // Notify citizen to verify when field worker submits resolution
    if (newStatus === 'Pending Verification' && issue.reporterId) {
      await Notification.create({
        userId: issue.reporterId,
        message: `Your issue "${issue.title}" has been resolved by the field worker. Please verify if it's fixed properly.`,
        type: 'pending_verification',
        issueId: issue.id,
      });
      io.to(`user:${issue.reporterId}`).emit('issue:pending_verification', { issue: await Issue.findByPk(issue.id) });
    }

    // Admin manually marking resolved
    if (newStatus === 'Resolved' && issue.reporterId) {
      await updateTrustScore(issue.reporterId, 10, io);
      await Notification.create({
        userId: issue.reporterId,
        message: `Your issue "${issue.title}" has been marked as resolved.`,
        type: 'issue_resolved',
        issueId: issue.id,
      });
    }

    io.to(`issue:${issue.id}`).emit('issue:updated', { issue: await Issue.findByPk(issue.id) });
    io.to(`user:${issue.reporterId}`).emit('issue:updated', { issue: await Issue.findByPk(issue.id) });

    res.json({ issue: await Issue.findByPk(issue.id) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyResolution = async (req, res) => {
  try {
    const { approved, feedback } = req.body;
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (issue.reporterId !== req.user.id) return res.status(403).json({ message: 'Only the reporter can verify' });
    if (issue.status !== 'Pending Verification') return res.status(400).json({ message: 'Issue is not pending verification' });

    const newStatus = approved ? 'Resolved' : 'Reopened';
    const fromStatus = issue.status;

    await issue.update({
      status: newStatus,
      citizenVerified: approved,
      citizenFeedback: feedback || null,
      citizenVerifiedAt: new Date(),
      resolvedAt: approved ? new Date() : null,
    });

    await StatusHistory.create({
      issueId: issue.id,
      changedBy: req.user.id,
      fromStatus,
      toStatus: newStatus,
      note: approved ? `Citizen verified: ${feedback || 'Issue confirmed fixed'}` : `Citizen rejected: ${feedback || 'Issue not fixed properly'}`,
    });

    const io = req.app.get('io');

    if (approved) {
      await updateTrustScore(req.user.id, 10, io);
      // Notify field worker
      if (issue.assignedToId) {
        await Notification.create({
          userId: issue.assignedToId,
          message: `Citizen verified that "${issue.title}" is properly resolved. Great work!`,
          type: 'citizen_approved',
          issueId: issue.id,
        });
        io.to(`user:${issue.assignedToId}`).emit('issue:updated', { issue });
      }
    } else {
      // Notify admin and field worker that issue was rejected
      if (issue.assignedToId) {
        await Notification.create({
          userId: issue.assignedToId,
          message: `Citizen reported that "${issue.title}" is NOT properly fixed. Please revisit.`,
          type: 'citizen_rejected',
          issueId: issue.id,
        });
        io.to(`user:${issue.assignedToId}`).emit('issue:updated', { issue });
      }
      io.to('admin').emit('issue:reopened', { issue, feedback });
    }

    const updated = await Issue.findByPk(issue.id);
    io.to(`issue:${issue.id}`).emit('issue:updated', { issue: updated });

    res.json({ issue: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.vote = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Vote.findOne({ where: { issueId: id, userId: req.user.id } });
    if (existing) return res.status(400).json({ message: 'Already voted' });

    await Vote.create({ issueId: id, userId: req.user.id });
    const issue = await Issue.findByPk(id);
    const newCount = issue.voteCount + 1;
    const updates = { voteCount: newCount };

    if (newCount >= 50 && issue.priority !== 'Critical') {
      updates.priority = 'Critical';
      const io = req.app.get('io');
      io.to('admin').emit('issue:updated', { issue: { ...issue.toJSON(), ...updates } });
    }

    await issue.update(updates);
    if (issue.reporterId) await updateTrustScore(issue.reporterId, 2, req.app.get('io'));

    const io = req.app.get('io');
    io.to(`issue:${id}`).emit('issue:updated', { issue: await Issue.findByPk(id) });

    res.json({ voteCount: newCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { issueId: req.params.id },
      include: [{ model: User, attributes: ['id', 'name', 'badge'] }],
      order: [['createdAt', 'ASC']],
    });
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.create({ text, issueId: req.params.id, userId: req.user.id });
    const full = await Comment.findByPk(comment.id, {
      include: [{ model: User, attributes: ['id', 'name', 'badge'] }],
    });
    req.app.get('io').to(`issue:${req.params.id}`).emit('comment:new', { comment: full });
    res.status(201).json({ comment: full });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
