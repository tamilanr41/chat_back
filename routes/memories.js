const express = require('express');
const Memory = require('../models/Memory');
const authMiddleware = require('../middleware/auth');
const { requireCouple } = require('../middleware/couple');

const router = express.Router();

router.use(authMiddleware, requireCouple);

/**
 * GET /api/memories
 * Returns all memories for the couple, sorted by date.
 */
router.get('/', async (req, res, next) => {
  try {
    const memories = await Memory.find({ coupleId: req.couple._id })
      .sort({ date: 1 })
      .populate('addedBy', 'name nickname');
    res.json({ memories });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/memories
 * body: { title, description?, date, image? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { title, description, date, image } = req.body;
    if (!title || !date) {
      return res.status(400).json({ message: 'title and date are required' });
    }

    const memory = await Memory.create({
      coupleId: req.couple._id,
      addedBy: req.userId,
      title: title.trim(),
      description: description || '',
      date: new Date(date),
      image: image || '',
    });

    res.status(201).json({ memory });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/memories/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const memory = await Memory.findOneAndDelete({ _id: req.params.id, coupleId: req.couple._id });
    if (!memory) return res.status(404).json({ message: 'Memory not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
