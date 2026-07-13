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

    onlineUsers.set(socket.userId, socket.id);

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

    socket.on('call:ring', ({ to, callType }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:ring', { from: socket.userId, callType });
      }
    });

    socket.on('call:accept', ({ to }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:accept', { from: socket.userId });
      }
    });

    socket.on('call:reject', ({ to }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:rejected', { from: socket.userId });
      }
    });

    socket.on('call:end', ({ to }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:end', { from: socket.userId });
      }
    });

    socket.on('call:offer', ({ to, offer, callType }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:offer', { from: socket.userId, offer, callType });
      }
    });

    socket.on('call:answer', ({ to, answer }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:answer', { answer });
      }
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit('call:ice-candidate', { candidate });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.userId);
      const set = onlineUsers.get(socket.coupleId);
      if (set) {
        set.delete(socket.userId);
        io.to(room).emit('presence:update', { online: Array.from(set) });
      }
    });
  });
}

module.exports = setupSocket;
