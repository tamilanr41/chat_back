const express = require('express');
const Couple = require('../models/Couple');
const DailyQuestion = require('../models/DailyQuestion');
const authMiddleware = require('../middleware/auth');
const { requireCouple } = require('../middleware/couple');

const router = express.Router();

router.use(authMiddleware, requireCouple);

// A small rotating pool of daily questions
const QUESTION_POOL = [
  "What's your favorite memory of us so far?",
  "What made you smile today?",
  "If we could teleport anywhere right now, where would we go?",
  "What's one thing you're grateful for about our relationship?",
  "What's a song that reminds you of me?",
  "What's your idea of a perfect date night?",
  "What's something new you'd like us to try together?",
  "What's your favorite thing about how I show love?",
  "If today had a theme song, what would it be?",
  "What's one small thing I do that makes your day better?",
];

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * GET /api/couple
 * Basic couple info: relationship start date, love meter, partner info.
 */
router.get('/', async (req, res, next) => {
  try {
    const couple = await Couple.findById(req.couple._id)
      .populate('user1', 'name nickname avatar')
      .populate('user2', 'name nickname avatar');

    res.json({ couple });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/couple/relationship-start
 * body: { date }
 */
router.patch('/relationship-start', async (req, res, next) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ message: 'date is required' });

    const couple = await Couple.findByIdAndUpdate(
      req.couple._id,
      { relationshipStartDate: new Date(date) },
      { new: true }
    );

    res.json({ relationshipStartDate: couple.relationshipStartDate });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/couple/love-meter/adjust
 * body: { delta } - e.g. +5 or -5, clamped 0-100
 */
router.post('/love-meter/adjust', async (req, res, next) => {
  try {
    const { delta } = req.body;
    const change = Number(delta);
    if (Number.isNaN(change)) return res.status(400).json({ message: 'delta must be a number' });

    const couple = await Couple.findById(req.couple._id);
    couple.loveMeter = Math.max(0, Math.min(100, couple.loveMeter + change));
    await couple.save();

    res.json({ loveMeter: couple.loveMeter });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/couple/daily-question
 * Returns (or creates) today's question + both partners' answers.
 */
router.get('/daily-question', async (req, res, next) => {
  try {
    const date = todayKey();
    let dq = await DailyQuestion.findOne({ coupleId: req.couple._id, date });

    if (!dq) {
      const question = QUESTION_POOL[Math.floor(Math.random() * QUESTION_POOL.length)];
      dq = await DailyQuestion.create({ coupleId: req.couple._id, date, question });
    }

    res.json({
      date: dq.date,
      question: dq.question,
      answers: Object.fromEntries(dq.answers || new Map()),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/couple/daily-question/answer
 * body: { answer }
 */
router.post('/daily-question/answer', async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ message: 'answer is required' });

    const date = todayKey();
    let dq = await DailyQuestion.findOne({ coupleId: req.couple._id, date });
    if (!dq) {
      const question = QUESTION_POOL[Math.floor(Math.random() * QUESTION_POOL.length)];
      dq = await DailyQuestion.create({ coupleId: req.couple._id, date, question });
    }

    dq.answers.set(String(req.userId), answer.trim());
    await dq.save();

    res.json({
      date: dq.date,
      question: dq.question,
      answers: Object.fromEntries(dq.answers),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
