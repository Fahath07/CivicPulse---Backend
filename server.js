const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const { sequelize } = require('./models');
const slaChecker = require('./utils/slaChecker');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/issues', require('./routes/issue.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/users', require('./routes/user.routes'));

io.on('connection', (socket) => {
  socket.on('join:issue', (issueId) => socket.join(`issue:${issueId}`));
  socket.on('join:user', (userId) => socket.join(`user:${userId}`));
  socket.on('join:admin', () => socket.join('admin'));
  socket.on('disconnect', () => {});
});

app.set('io', io);
slaChecker.setIo(io);

cron.schedule('0 * * * *', slaChecker);

sequelize.sync({ alter: true })
  .then(() => {
    console.log('PostgreSQL connected and tables synced');
    httpServer.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch(err => console.error('Database error:', err));
