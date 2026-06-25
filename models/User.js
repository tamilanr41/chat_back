const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    nickname: { type: String, default: '' },

    // The pair / couple this user belongs to
    coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
