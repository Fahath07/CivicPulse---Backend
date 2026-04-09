const bcrypt = require('bcryptjs');
const { User, Issue, Notification } = require('../models');

exports.getProfile = async (req, res) => {
  try {
    const stats = {
      total: await Issue.count({ where: { reporterId: req.user.id } }),
      resolved: await Issue.count({ where: { reporterId: req.user.id, status: 'Resolved' } }),
      pending: await Issue.count({ where: { reporterId: req.user.id, status: ['Open', 'Assigned', 'In Progress'] } }),
    };
    res.json({ user: req.user, stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, ward } = req.body;
    await req.user.update({ name, phone, ward });
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.update({ read: true }, { where: { userId: req.user.id, read: false } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNotifPrefs = async (req, res) => {
  try {
    const { notifInApp } = req.body;
    await req.user.update({ notifInApp });
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
