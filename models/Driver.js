const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  vehicleNo: {
    type: String,
    required: [true, 'Vehicle number is required'],
    trim: true,
    uppercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Driver', driverSchema);
