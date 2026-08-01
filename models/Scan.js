const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  type: {
    type: String,
    enum: ['EXIT', 'ENTRY'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for fast queries by driver and date
scanSchema.index({ driverId: 1, timestamp: -1 });

module.exports = mongoose.model('Scan', scanSchema);
