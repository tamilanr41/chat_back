const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { requireCouple } = require('../middleware/couple');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

router.post('/chat/upload', authMiddleware, requireCouple, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    try {
      const imageUrl = `/uploads/${req.file.filename}`;
      const { replyTo } = req.body;

      const msgData = {
        coupleId: req.couple._id,
        sender: req.userId,
        text: imageUrl,
        type: 'image',
      };

      if (replyTo) {
        try {
          const parsed = typeof replyTo === 'string' ? JSON.parse(replyTo) : replyTo;
          msgData.replyTo = {
            messageId: parsed.messageId,
            text: parsed.text,
            sender: parsed.senderId,
          };
        } catch {}
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
    } catch (error) {
      next(error);
    }
  });
});

router.post('/memory/upload', authMiddleware, requireCouple, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image too large. Max 10MB.' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }
    try {
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      next(error);
    }
  });
});

// POST /chat/upload-audio
router.post('/chat/upload-audio', authMiddleware, requireCouple, (req, res, next) => {
  const audioUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed'), false);
      }
    },
  }).single('audio');

  audioUpload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No audio provided' });
    }

    try {
      const audioUrl = `/uploads/${req.file.filename}`;
      const { replyTo } = req.body;

      const msgData = {
        coupleId: req.couple._id,
        sender: req.userId,
        text: audioUrl,
        type: 'audio',
      };

      if (replyTo) {
        try {
          const parsed = typeof replyTo === 'string' ? JSON.parse(replyTo) : replyTo;
          msgData.replyTo = {
            messageId: parsed.messageId,
            text: parsed.text,
            sender: parsed.senderId,
          };
        } catch {}
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
    } catch (error) {
      next(error);
    }
  });
});

// POST /chat/upload-video
router.post('/chat/upload-video', authMiddleware, requireCouple, (req, res, next) => {
  const videoUpload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only video files are allowed'), false);
      }
    },
  }).single('video');

  videoUpload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No video provided' });
    }

    try {
      const videoUrl = `/uploads/${req.file.filename}`;
      const { replyTo } = req.body;

      const msgData = {
        coupleId: req.couple._id,
        sender: req.userId,
        text: videoUrl,
        type: 'video',
      };

      if (replyTo) {
        try {
          const parsed = typeof replyTo === 'string' ? JSON.parse(replyTo) : replyTo;
          msgData.replyTo = {
            messageId: parsed.messageId,
            text: parsed.text,
            sender: parsed.senderId,
          };
        } catch {}
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
    } catch (error) {
      next(error);
    }
  });
});

// POST /auth/avatar — upload profile picture
router.post('/auth/avatar', authMiddleware, (req, res, next) => {
  const avatarUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    },
  }).single('avatar');

  avatarUpload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    try {
      const avatarUrl = `/uploads/${req.file.filename}`;
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.userId, { avatar: avatarUrl });

      res.json({ avatar: avatarUrl });
    } catch (error) {
      next(error);
    }
  });
});

// GET /auth/me — already exists in auth.js, but we update it here via the User model directly
// The avatar URL is now accessible via GET /api/auth/me

module.exports = router;
