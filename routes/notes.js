const express = require('express');
const Note = require('../models/Note');
const authMiddleware = require('../middleware/auth');
const { requireCouple } = require('../middleware/couple');

const router = express.Router();

router.use(authMiddleware, requireCouple);

router.get('/', async (req, res, next) => {
  try {
    const notes = await Note.find({ coupleId: req.couple._id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name nickname');
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { text, color } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'text is required' });
    }
    const note = await Note.create({
      coupleId: req.couple._id,
      text: text.trim(),
      color: color || '#fff5d0',
      createdBy: req.userId,
    });
    const populated = await note.populate('createdBy', 'name nickname');
    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('note:new', populated);
    }
    res.status(201).json({ note: populated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (String(note.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the author can delete' });
    }
    await note.deleteOne();
    const io = req.app.get('io');
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('note:delete', { id: req.params.id });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
