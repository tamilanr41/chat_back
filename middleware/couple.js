const Couple = require('../models/Couple');

/**
 * Loads the couple the given user belongs to.
 * Returns null if user has no couple yet (hasn't paired up).
 */
async function getCoupleForUser(userId) {
  const couple = await Couple.findOne({
    $or: [{ user1: userId }, { user2: userId }],
  });
  return couple;
}

/**
 * Express middleware: ensures the requester belongs to an active couple
 * (both user1 and user2 set), and attaches req.couple
 */
async function requireCouple(req, res, next) {
  try {
    const couple = await getCoupleForUser(req.userId);
    if (!couple) {
      return res.status(403).json({ message: 'You have not joined or created a couple yet' });
    }
    if (couple.status !== 'active' || !couple.user2) {
      return res.status(403).json({ message: 'Waiting for your partner to join with the invite code' });
    }
    req.couple = couple;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { getCoupleForUser, requireCouple };
