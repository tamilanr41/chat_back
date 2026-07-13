const jwt = require('jsonwebtoken');
const Couple = require('../models/Couple');

const userSockets = new Map();
const couplePresence = new Map();

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

    userSockets.set(socket.userId, socket.id);

    if (!couplePresence.has(socket.coupleId)) {
      couplePresence.set(socket.coupleId, new Set());
    }
    couplePresence.get(socket.coupleId).add(socket.userId);

    io.to(room).emit('presence:update', {
      online: Array.from(couplePresence.get(socket.coupleId)),
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
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ring', { from: socket.userId, callType });
        console.log(`[Call] Ring: ${socket.userId} -> ${to} (${callType})`);
      } else {
        console.log(`[Call] Ring failed: ${to} not connected`);
      }
    });

    socket.on('call:accept', ({ to }) => {
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:accept', { from: socket.userId });
        console.log(`[Call] Accept: ${socket.userId} -> ${to}`);
      }
    });

    socket.on('call:reject', ({ to }) => {
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:rejected', { from: socket.userId });
        console.log(`[Call] Reject: ${socket.userId} -> ${to}`);
      }
    });

    socket.on('call:end', ({ to }) => {
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:end', { from: socket.userId });
        console.log(`[Call] End: ${socket.userId} -> ${to}`);
      }
    });

    socket.on('call:offer', ({ to, offer, callType }) => {
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:offer', { from: socket.userId, offer, callType });
        console.log(`[Call] Offer: ${socket.userId} -> ${to}`);
      }
    });

    socket.on('call:answer', ({ to, answer }) => {
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:answer', { answer });
        console.log(`[Call] Answer: ${socket.userId} -> ${to}`);
      }
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
      const targetSocketId = userSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ice-candidate', { candidate });
      }
    });

    socket.on('disconnect', () => {
      userSockets.delete(socket.userId);
      const set = couplePresence.get(socket.coupleId);
      if (set) {
        set.delete(socket.userId);
        io.to(room).emit('presence:update', { online: Array.from(set) });
      }
    });
  });
}

module.exports = setupSocket;
