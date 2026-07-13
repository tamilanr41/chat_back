const jwt = require('jsonwebtoken');
const Couple = require('../models/Couple');

const onlineUsers = new Map();

function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;

      const couple = await Couple.findOne({
        $or: [{ user1: decoded.userId }, { user2: decoded.userId }],
      });
      if (!couple || !couple.user2) return next(new Error('Couple not active'));

      socket.coupleId = String(couple._id);
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const room = `couple:${socket.coupleId}`;
    socket.join(room);

    if (!onlineUsers.has(socket.coupleId)) {
      onlineUsers.set(socket.coupleId, new Set());
    }
    onlineUsers.get(socket.coupleId).add(socket.userId);

    io.to(room).emit('presence:update', {
      online: Array.from(onlineUsers.get(socket.coupleId)),
    });

    socket.on('typing:start', () => {
      socket.to(room).emit('typing:start', { userId: socket.userId });
    });

    socket.on('typing:stop', () => {
      socket.to(room).emit('typing:stop', { userId: socket.userId });
    });

    socket.on('send:hug', () => {
      socket.to(room).emit('receive:hug', { from: socket.userId });
    });

    socket.on('send:kiss', () => {
      socket.to(room).emit('receive:kiss', { from: socket.userId });
    });

    socket.on('send:emoji', ({ emoji }) => {
      socket.to(room).emit('receive:emoji', { emoji, from: socket.userId });
    });

    socket.on('disconnect', () => {
      const set = onlineUsers.get(socket.coupleId);
      if (set) {
        set.delete(socket.userId);
        io.to(room).emit('presence:update', { online: Array.from(set) });
      }
    });
  });
}

module.exports = setupSocket;
