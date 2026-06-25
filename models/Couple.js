const mongoose = require('mongoose');

const coupleSchema = new mongoose.Schema(
  {
    inviteCode: { type: String, required: true, unique: true },

    // user1 creates the couple; user2 joins later
    user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    relationshipStartDate: { type: Date, default: null },

    // simple love meter (0-100)
    loveMeter: { type: Number, default: 50 },

    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Couple', coupleSchema);
