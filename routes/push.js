const express = require('express');
const webpush = require('web-push');
const authMiddleware = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');

const router = express.Router();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:noreply@couplesapp.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

router.post('/push/subscribe', authMiddleware, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: req.userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/push/unsubscribe', authMiddleware, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await PushSubscription.deleteOne({ endpoint });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

async function sendPushToUser(userId, payload) {
  try {
    console.log('[Push] Sending to userId:', userId);
    console.log('[Push] VAPID keys set:', !!process.env.VAPID_PRIVATE_KEY, !!process.env.VAPID_PUBLIC_KEY);
    const subs = await PushSubscription.find({ userId });
    console.log('[Push] Subscriptions found:', subs.length);
    if (subs.length === 0) {
      console.log('[Push] No subscriptions for user:', userId);
      return;
    }
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        )
      )
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log('[Push] Sent successfully to sub', i);
      } else {
        console.error('[Push] Failed for sub', i, ':', r.reason?.statusCode, r.reason?.message);
      }
    });
    // Remove expired subscriptions
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected' && results[i].reason?.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: subs[i]._id });
      }
    }
  } catch (e) {
    console.error('[Push] sendPushToUser error:', e.message);
  }
}

module.exports = router;
module.exports.sendPushToUser = sendPushToUser;
