const express = require('express');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { requireCouple } = require('../middleware/couple');

const router = express.Router();

router.use(authMiddleware, requireCouple);

router.get('/messages', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const query = { coupleId: req.couple._id };

    if (req.query.before) {
      const beforeMsg = await Message.findById(req.query.before);
      if (beforeMsg) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'name nickname avatar')
      .populate('replyTo.sender', 'name');

    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
});

router.post('/messages', async (req, res, next) => {
  try {
    const { text, type, replyTo } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'text is required' });
    }

    const msgData = {
      coupleId: req.couple._id,
      sender: req.userId,
      text: text.trim(),
      type: ['image', 'sticker', 'audio'].includes(type) ? type : 'text',
    };

    if (replyTo && replyTo.messageId) {
      msgData.replyTo = {
        messageId: replyTo.messageId,
        text: replyTo.text,
        sender: replyTo.senderId,
      };
    }

    const message = await Message.create(msgData);
    const populated = await message.populate([
      { path: 'sender', select: 'name nickname avatar' },
      { path: 'replyTo.sender', select: 'name' },
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('message:new', populated);
    }

    res.status(201).json({ message: populated });
  } catch (err) {
    next(err);
  }
});

router.patch('/messages/read', async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !messageIds.length) {
      return res.json({ success: true });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, coupleId: req.couple._id, read: false },
      { read: true, readAt: new Date() }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('messages:read', {
        userId: req.userId,
        messageIds,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/messages/:id', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'text is required' });
    }

    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (String(message.sender) !== String(req.userId)) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    message.text = text.trim();
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('message:edit', { id: message._id, text: message.text });
    }

    res.json({ message });
  } catch (err) {
    next(err);
  }
});

router.delete('/messages/:id', async (req, res, next) => {
  try {
    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (String(message.sender) !== String(req.userId)) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    await message.deleteOne();

    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('message:delete', { id: message._id });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/messages/:id/react', async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'emoji is required' });

    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const existing = message.reactions.find(
      (r) => String(r.userId) === String(req.userId) && r.emoji === emoji
    );

    if (existing) {
      message.reactions.pull({ _id: existing._id });
    } else {
      message.reactions.push({ emoji, userId: req.userId });
    }

    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('message:react', {
        id: message._id,
        reactions: message.reactions,
      });
    }

    res.json({ reactions: message.reactions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
