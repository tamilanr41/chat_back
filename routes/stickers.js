const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Sticker = require('../models/Sticker');
const authMiddleware = require('../middleware/auth');
const { requireCouple } = require('../middleware/couple');

const router = express.Router();

router.use(authMiddleware, requireCouple);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = 'sticker-' + Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

router.post('/upload', (req, res, next) => {
  upload.single('sticker')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No sticker provided' });
    }
    try {
      const sticker = await Sticker.create({
        coupleId: req.couple._id,
        imageUrl: `/uploads/${req.file.filename}`,
        uploadedBy: req.userId,
      });
      res.status(201).json({ sticker });
    } catch (error) {
      next(error);
    }
  });
});

router.get('/', async (req, res, next) => {
  try {
    const stickers = await Sticker.find({ coupleId: req.couple._id })
      .sort({ createdAt: -1 });
    res.json({ stickers });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const sticker = await Sticker.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!sticker) return res.status(404).json({ message: 'Sticker not found' });
    if (String(sticker.uploadedBy) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the uploader can delete' });
    }
    await sticker.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
