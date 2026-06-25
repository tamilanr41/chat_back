const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'audio', 'sticker'], default: 'text' },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    reactions: [{ emoji: String, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
