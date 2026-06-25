const mongoose = require('mongoose');

const dailyQuestionSchema = new mongoose.Schema(
  {
    coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD, one question per day
    question: { type: String, required: true },
    answers: {
      type: Map,
      of: String, // userId -> answer text
      default: {},
    },
  },
  { timestamps: true }
);

dailyQuestionSchema.index({ coupleId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyQuestion', dailyQuestionSchema);
