require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const qrcode = require('qrcode');

const Driver = require('./models/Driver');
const Scan = require('./models/Scan');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ==========================================
// Helper: IST date range
// ==========================================
function getDateRange(dateString) {
  let year, month, date;
  if (dateString) {
    const parts = dateString.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    date = parseInt(parts[2], 10);
  } else {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    year = ist.getFullYear();
    month = ist.getMonth();
    date = ist.getDate();
  }
  const start = new Date(Date.UTC(year, month, date, -5, -30, 0, 0));
  const end = new Date(Date.UTC(year, month, date, 18, 29, 59, 999));
  return { start, end };
}

// Get current IST date string
function getISTDateString() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  return ist.toISOString().split('T')[0];
}

// ==========================================
// DRIVER ROUTES
// ==========================================

// Register
app.post('/api/drivers/register', async (req, res) => {
  try {
    const { name, phone, vehicleNo } = req.body;
    if (!name || !phone || !vehicleNo) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await Driver.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'Phone number already registered. Please login instead.' });
    }

    const driver = new Driver({ name, phone, vehicleNo: vehicleNo.toUpperCase() });
    await driver.save();
    console.log(`Registered: ${name} (${vehicleNo.toUpperCase()})`);
    res.status(201).json({ driver });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/drivers/login', async (req, res) => {
  try {
    const { phone } = req.body;
    const driver = await Driver.findOne({ phone });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found. Please register first.' });
    }
    res.json({ driver });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get driver by ID
app.get('/api/drivers/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ driver });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// SCAN — Driver scans gate QR
// ==========================================
app.post('/api/scan', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ error: 'Driver not identified. Please login first.' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const { start, end } = getDateRange();

    // Find last scan today
    const lastScan = await Scan.findOne({
      driverId: driver._id,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 });

    // Alternate: no scan or last=ENTRY → EXIT, last=EXIT → ENTRY
    let newScanType = 'EXIT';
    if (lastScan && lastScan.type === 'EXIT') {
      newScanType = 'ENTRY';
    }

    const scan = new Scan({
      driverId: driver._id,
      type: newScanType,
      timestamp: new Date()
    });
    await scan.save();

    // Count completed trips today
    const tripCount = await Scan.countDocuments({
      driverId: driver._id,
      type: 'ENTRY',
      timestamp: { $gte: start, $lte: end }
    });

    // Get all scans today for this driver (to send in real-time)
    const allScansToday = await Scan.find({
      driverId: driver._id,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });

    const message = newScanType === 'EXIT'
      ? `${driver.name} — Departed with load`
      : `${driver.name} — Trip #${tripCount} completed!`;
    console.log(message);

    // Emit real-time update
    io.emit('scan-update', {
      driverId: driver._id.toString(),
      driverName: driver.name,
      vehicleNo: driver.vehicleNo,
      scanType: newScanType,
      tripCount,
      scanTime: scan.timestamp.toISOString(),
      allScans: allScansToday
    });

    res.json({
      driver: { name: driver.name, vehicleNo: driver.vehicleNo },
      scanType: newScanType,
      tripCount,
      scanTime: scan.timestamp.toISOString(),
      message
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Scan failed. Please try again.' });
  }
});

// ==========================================
// TRIPS
// ==========================================

// Get trips + all scans for a driver on a date
app.get('/api/trips/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { date } = req.query;
    const { start, end } = getDateRange(date);

    const scans = await Scan.find({
      driverId,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });

    const tripCount = scans.filter(s => s.type === 'ENTRY').length;
    const dateStr = date || getISTDateString();

    res.json({ tripCount, scans, date: dateStr });
  } catch (error) {
    console.error('Trips error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 7-day history
app.get('/api/trips/:driverId/history', async (req, res) => {
  try {
    const { driverId } = req.params;
    const history = [];

    for (let i = 6; i >= 0; i--) {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const ist = new Date(utc + (3600000 * 5.5));
      ist.setDate(ist.getDate() - i);

      const dateString = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
      const { start, end } = getDateRange(dateString);

      const trips = await Scan.countDocuments({
        driverId,
        type: 'ENTRY',
        timestamp: { $gte: start, $lte: end }
      });

      history.push({ date: dateString, trips });
    }

    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// ADMIN
// ==========================================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || '#Nenavath';
  res.json({ success: password === adminPassword });
});

// Admin: get all drivers with ALL their scans for a given date
app.get('/api/admin/trips', async (req, res) => {
  try {
    const { date } = req.query;
    const { start, end } = getDateRange(date);
    const dateStr = date || getISTDateString();

    const drivers = await Driver.find({});
    const result = [];

    for (const driver of drivers) {
      const scans = await Scan.find({
        driverId: driver._id,
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: 1 }); // Oldest first so we can pair EXIT→ENTRY

      const tripCount = scans.filter(s => s.type === 'ENTRY').length;

      result.push({
        driver: {
          _id: driver._id,
          name: driver.name,
          phone: driver.phone,
          vehicleNo: driver.vehicleNo
        },
        tripCount,
        scans: scans // ALL scans with real timestamps
      });
    }

    result.sort((a, b) => b.tripCount - a.tripCount);
    res.json({ trips: result, date: dateStr });
  } catch (error) {
    console.error('Admin trips error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// All drivers
app.get('/api/admin/drivers', async (req, res) => {
  try {
    const drivers = await Driver.find({}).sort({ createdAt: -1 });
    res.json({ drivers });
  } catch (error) {
    console.error('Admin drivers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// GATE QR CODE
// ==========================================
app.get('/api/gate/qr', async (req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const gateUrl = `${siteUrl}/gate-scan.html`;

    const qrDataUrl = await qrcode.toDataURL(gateUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0a0f1a', light: '#ffffff' }
    });

    res.json({ qrDataUrl, gateUrl });
  } catch (error) {
    console.error('Gate QR error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// Start
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\nRentZoo Trip Counter running at http://localhost:${PORT}`);
  console.log(`Gate QR URL: http://localhost:${PORT}/gate-scan.html`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin.html\n`);
});
