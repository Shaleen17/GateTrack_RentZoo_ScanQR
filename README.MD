# 🚛 GateTrack — QR-Based Vehicle Trip Management System

> A real-time, QR-code-driven vehicle trip tracking platform built for construction sites — eliminating manual logs, enabling live supervisor monitoring, and generating tamper-resistant daily trip records per driver.

---

## 🧩 Problem It Solves

Construction site managers traditionally relied on **paper-based or verbal trip logging** to track how many load trips each dump truck driver completed per day. This approach led to:

- ❌ Inaccurate or disputed trip counts affecting driver payments
- ❌ Zero real-time visibility for supervisors
- ❌ No historical audit trail per driver/vehicle
- ❌ Dependency on dedicated staff just for manual counting

**GateTrack** replaces this entirely with an automated, mobile-first, hardware-free solution.

---

## ✅ How It Works

```
Driver arrives at gate
        │
        ▼
Scans gate QR code (mobile browser — no app needed)
        │
        ▼
System checks last scan state in MongoDB
        │
   ┌────┴────┐
   │         │
  EXIT     ENTRY
(departed  (returned
with load)  empty)
        │
        ▼
Trip count updated → Admin dashboard notified in real-time via WebSocket
```

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────┐
│                  CLIENT LAYER                │
│   Driver Mobile  │  Admin Panel  │  Gate QR  │
└──────────┬───────┴───────┬───────┴───────────┘
           │               │ (WebSocket)
           ▼               ▼
┌──────────────────────────────────────────────┐
│              Node.js + Express.js            │
│  REST API  │  Socket.io Server  │  QR Gen   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             MongoDB (Mongoose ODM)           │
│    Driver Collection  │  Scan Collection     │
└──────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer         | Technology            | Purpose                                |
| ------------- | --------------------- | -------------------------------------- |
| **Runtime**   | Node.js               | Server-side JavaScript execution       |
| **Framework** | Express.js            | RESTful API routing & middleware       |
| **Database**  | MongoDB + Mongoose    | Persistent data storage with ODM       |
| **Real-time** | Socket.io (WebSocket) | Live event push to admin dashboard     |
| **QR Code**   | `qrcode` library      | Dynamic gate QR generation             |
| **Frontend**  | HTML5 / Vanilla JS    | Driver & Admin UI (no framework)       |
| **Config**    | dotenv                | Secure environment variable management |

---

## 📁 Project Structure

```
gatetrack/
├── models/
│   ├── Driver.js          # Mongoose schema — Driver (name, phone, vehicleNo)
│   └── Scan.js            # Mongoose schema — Scan (driverId, type, timestamp)
├── public/
│   ├── index.html         # Driver registration & login page
│   ├── driver.html        # Driver dashboard (trip count + 7-day history)
│   ├── gate-scan.html     # Gate scan page (opened via QR code)
│   ├── admin.html         # Admin live monitoring panel
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side scripts
│   └── assets/            # Images & icons
├── server.js              # Main application server
├── package.json
├── .env                   # Environment config (not committed)
└── README.md
```

---

## 🔌 API Reference

### Driver

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| `POST` | `/api/drivers/register` | Register a new driver |
| `POST` | `/api/drivers/login`    | Login by phone number |
| `GET`  | `/api/drivers/:id`      | Get driver profile    |

### Scanning

| Method | Endpoint    | Description                                     |
| ------ | ----------- | ----------------------------------------------- |
| `POST` | `/api/scan` | Process a gate QR scan (auto ENTRY/EXIT toggle) |

### Trips

| Method | Endpoint                       | Description                       |
| ------ | ------------------------------ | --------------------------------- |
| `GET`  | `/api/trips/:driverId`         | Get today's trip count + scan log |
| `GET`  | `/api/trips/:driverId/history` | Get 7-day rolling trip history    |

### Admin

| Method | Endpoint             | Description                       |
| ------ | -------------------- | --------------------------------- |
| `POST` | `/api/admin/login`   | Admin authentication              |
| `GET`  | `/api/admin/trips`   | All drivers' trip data for a date |
| `GET`  | `/api/admin/drivers` | List all registered drivers       |
| `GET`  | `/api/gate/qr`       | Generate gate QR code image       |

---

## ⚙️ Key Technical Features

### 🔄 Stateful ENTRY/EXIT Toggle

The scan API implements a **state-machine pattern** — on every scan, it fetches the driver's most recent scan from MongoDB and automatically alternates the scan type (`EXIT → ENTRY → EXIT`). No manual input required from the driver.

### 📡 Real-time WebSocket Broadcasting

Every scan event emits a `scan-update` payload over **Socket.io**, instantly pushing updated trip counts and scan logs to all connected admin dashboards — no polling, zero latency delay.

### 🕐 IST Timezone Normalization

Custom `getDateRange()` utility converts UTC MongoDB timestamps to **Indian Standard Time (IST, UTC+5:30)** day boundaries, ensuring trip aggregation is scoped correctly to the calendar day regardless of server timezone.

### 🗂️ Compound MongoDB Index

The `Scan` collection uses a **compound index on `{ driverId, timestamp }`** for O(log n) range query performance, critical for fast daily and historical trip aggregation across many drivers.

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas URI (or local MongoDB instance)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/gatetrack.git
cd gatetrack

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Admin Password, Site URL

# Start the server
npm start
```

### Environment Variables

```env
MONGODB_URI=your_mongodb_connection_string
ADMIN_PASSWORD=your_secure_admin_password
SITE_URL=https://yourdomain.com
PORT=3000
```

---

## 📸 Screens

| Driver Login            | Gate Scan                  | Admin Dashboard                         |
| ----------------------- | -------------------------- | --------------------------------------- |
| Register/login by phone | Scan QR → instant trip log | Live table of all drivers + trip counts |

---

## 💡 Real-World Impact

- ✅ **Eliminated manual counting** — site supervisors no longer need dedicated staff for trip tallying
- ✅ **Payment accuracy** — drivers are paid based on verified, timestamped, database-backed trip records
- ✅ **Zero hardware cost** — works on any smartphone browser; no app install, no NFC tags, no RFID readers
- ✅ **Audit trail** — every scan is stored with a precise UTC timestamp, queryable by date and driver

---

## 👨‍💻 Author

Built for **RentZoo** as a contract project.  
_Backend development, API design, real-time architecture & database modeling._

---

## 📄 License

This project is proprietary and built under contract for RentZoo. Not open for redistribution.
