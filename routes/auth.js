const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const Couple = require('../models/Couple');
const authMiddleware = require('../middleware/auth');
const { getCoupleForUser } = require('../middleware/couple');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function generateInviteCode() {
  // e.g. "LOVE-7F3A9C"
  return 'LOVE-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * POST /api/auth/signup
 * body: { name, email, password }
 * Creates the user. Does NOT create or join a couple yet.
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed });

    const token = signToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, nickname: user.nickname },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const couple = await getCoupleForUser(user._id);

    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, nickname: user.nickname },
      couple: couple
        ? {
            id: couple._id,
            inviteCode: couple.inviteCode,
            status: couple.status,
            hasPartner: !!couple.user2,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current user + their couple status
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const couple = await getCoupleForUser(user._id);

    res.json({
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, nickname: user.nickname },
      couple: couple
        ? {
            id: couple._id,
            inviteCode: couple.inviteCode,
            status: couple.status,
            hasPartner: !!couple.user2,
            relationshipStartDate: couple.relationshipStartDate,
            loveMeter: couple.loveMeter,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/couple/create
 * Creates a new couple with the current user as user1, generates an invite code.
 * If the user already has a couple, returns the existing one.
 */
router.post('/couple/create', authMiddleware, async (req, res, next) => {
  try {
    let couple = await getCoupleForUser(req.userId);
    if (couple) {
      return res.json({
        id: couple._id,
        inviteCode: couple.inviteCode,
        status: couple.status,
        hasPartner: !!couple.user2,
      });
    }

    let inviteCode;
    let exists = true;
    // ensure uniqueness
    while (exists) {
      inviteCode = generateInviteCode();
      exists = await Couple.findOne({ inviteCode });
    }

    couple = await Couple.create({
      inviteCode,
      user1: req.userId,
      status: 'pending',
    });

    await User.findByIdAndUpdate(req.userId, { coupleId: couple._id });

    res.status(201).json({
      id: couple._id,
      inviteCode: couple.inviteCode,
      status: couple.status,
      hasPartner: false,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/couple/join
 * body: { inviteCode }
 * Current user joins an existing couple as user2.
 */
router.post('/couple/join', authMiddleware, async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ message: 'inviteCode is required' });
    }

    const existingCouple = await getCoupleForUser(req.userId);
    if (existingCouple) {
      return res.status(409).json({ message: 'You are already part of a couple' });
    }

    const couple = await Couple.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
    if (!couple) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    if (String(couple.user1) === String(req.userId)) {
      return res.status(400).json({ message: 'You cannot join your own invite code' });
    }

    if (couple.user2) {
      return res.status(409).json({ message: 'This couple already has two members' });
    }

    couple.user2 = req.userId;
    couple.status = 'active';
    await couple.save();

    await User.findByIdAndUpdate(req.userId, { coupleId: couple._id });

    res.json({
      id: couple._id,
      inviteCode: couple.inviteCode,
      status: couple.status,
      hasPartner: true,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
