# KConnect Backend API

This directory contains the Express/Node.js backend for the KConnect application. It provides real-time WebRTC signaling via Socket.io, REST APIs for user authentication/profile management, and meeting coordination.

## 📂 File Structure Explained

```text
backend/
│
├── middleware/          # Custom Express middleware
│   └── auth.js          # JWT Verification Middleware: Intercepts requests, validates the 'Authorization: Bearer <token>' header, and attaches the authenticated user object to `req.user`.
│
├── models/              # Mongoose Data Schemas (Database Structure)
│   ├── Meeting.js       # Defines a Meeting (title, ID, host, array of participants).
│   └── User.js          # Defines a User (username, email, password, profilePic). Automatically hashes passwords before saving using bcryptjs pre-save hooks.
│
├── routes/              # Express Router endpoints categorized by feature
│   ├── auth.js          # Registration, local login, and mock Google login. Generates JWTs for authenticated users.
│   ├── meetings.js      # Creates new meetings (generates short ID) and fetches meeting details by ID.
│   └── users.js         # Protected endpoints for getting/updating a user's own profile and password.
│
├── .env                 # Environment variables (IGNORED IN GIT). Contains MONGO_URI, JWT_SECRET, PORT.
├── package.json         # Backend dependencies and scripts.
└── server.js            # Main Application Entry Point
```

### 🧠 Deep Dive: `server.js`
The `server.js` file is the core of the backend. It handles:
1. **Express & DB Setup:** Initializes Mongoose connection, enables body parsing and CORS.
2. **REST API Routing:** Connects the routes from `/routes/` to base paths (`/api/auth`, `/api/users`, etc.).
3. **Socket.io Signaling (WebRTC):** 
   - Uses a basic HTTP server instance inside Express to attach Socket.io.
   - Manages state dictionaries for `users` (which users are in which room) and `socketToRoom` (quick lookup for disconnects).
   - Listens to `join room`, `sending signal`, and `returning signal` events to facilitate P2P WebRTC handshakes for video calling.

## 🛠 Setup & Run
1. Create a `.env` file referencing the same variables in the deployment config.
2. `npm install`
3. `npm start` (or `node server.js`)
