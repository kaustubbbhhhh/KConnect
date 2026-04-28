# KConnect Full-Stack Architecture Report

This document outlines the complete architectural design, component structure, networking flowchart, and deployment roadmap for the KConnect video calling platform.

---

## 1. High-Level Architecture
KConnect utilizes the modern MERN (MongoDB, Express, React, Node.js) stack alongside WebRTC for real-time video communication:
- **Frontend**: A React SPA (Single Page Application) built with Vite for optimal performance and hot module replacement. It uses `react-router-dom` for navigation and a global Context API for user state management.
- **Backend API**: An Express.js REST API serving authentication and meeting creation requests, fortified with JWT (JSON Web Tokens).
- **Database**: MongoDB handles persistent storage of User credentials (passwords hashed via bcrypt) and Meeting records.
- **Real-time Networking**: 
  - **Signaling Layer**: `Socket.io` coordinates the discovery of participants in a room.
  - **Media Layer**: Client browsers execute peer-to-peer WebRTC connections (assisted by `simple-peer`) to transmit live audio/video feeds directly to each other in a Mesh topology.

---

## 2. Project Directory Structure

```text
e:\KConnect\
├── backend/                  # The Node.js/Express Server Environment
│   ├── middleware/           # Intercepts incoming requests
│   │   └── auth.js           # Validates JWT Bearer tokens before allowing action
│   ├── models/               # MongoDB Database Schemas
│   │   ├── Meeting.js        # Defines how meetings are stored
│   │   └── User.js           # Defines how users and hashed passwords are stored
│   ├── routes/               # Express API Endpoints
│   │   ├── auth.js           # Login, Register, Google Mock login
│   │   ├── meetings.js       # Create and Retrieve Meeting IDs
│   │   └── users.js          # Fetch and Update User Profile elements
│   ├── .env                  # Secure environment variables (DB URI, JWT Secret)
│   ├── package.json          # Backend dependencies
│   └── server.js             # Main entry point (Mounts Express, MongoDB, Socket.io)
│   
├── src/                      # The React Frontend Environment
│   ├── components/           # Reusable UI Blocks
│   │   └── Header.jsx        # Navigation bar & User Avatar tracker
│   ├── context/              # Global State Handlers
│   │   └── AuthContext.jsx   # Heartbeat of the frontend; manages login status & API calls
│   ├── pages/                # Main Application Views
│   │   ├── Dashboard.jsx     # Post-login hub (New / Join / Schedule actions)
│   │   ├── Login.jsx         # Sign up / Sign in forms
│   │   ├── Room.jsx          # The WebRTC Video grid matrix
│   │   └── Settings.jsx      # Profile modification UI
│   ├── App.jsx               # React Router layout defining protected endpoints
│   ├── index.css             # Global dark-mode glassmorphic design tokens
│   └── main.jsx              # React DOM root render
│
├── package.json              # Frontend dependencies
└── vite.config.js            # Build config & Dev Server Proxy setup
```

---

## 3. WebRTC & Socket.io Flowchart
A visual representation of how the video room connects participants via a Signaling server handshake before upgrading to Peer-to-Peer video streaming.

```mermaid
sequenceDiagram
    participant UserA as User A (Browser)
    participant Server as Socket.io Server (Node.js)
    participant UserB as User B (Browser)

    Note over UserA, UserB: Both users open the same Room ID (/room/123)
    
    UserA->>Server: Emit "join room" (Room 123)
    Server-->>UserA: Emit "all users" [empty array]
    Note right of UserA: User A is alone in the room, streams webcam to screen.

    UserB->>Server: Emit "join room" (Room 123)
    Server-->>UserB: Emit "all users" [UserA_Socket_ID]
    Note right of UserB: User B discovers User A is already present.

    UserB->>Server: Emit "sending signal" (WebRTC Calling Offer for User A)
    Server-->>UserA: Emit "user joined" (Forwards B's Calling Offer)
    
    Note left of UserA: User A accepts the call.
    UserA->>Server: Emit "returning signal" (WebRTC Answer for User B)
    Server-->>UserB: Emit "receiving returned signal" (Forwards A's Answer)

    Note over UserA, UserB: The WebRTC handshake is complete. Socket.io's job is done.
    
    UserA<-->>UserB: DIRECT PEER-TO-PEER VIDEO & AUDIO STREAM
```

---

## 4. Frontend Component Breakdown 
- **`AuthContext.jsx`**: Wraps the entire application. It executes `fetch()` requests specifically to the `/api/auth` endpoints. Upon successful login, it stores the returned User Object and JWT Token inside the browser's `localStorage` to keep the user authenticated even if they close and reopen the tab.
- **`Dashboard.jsx`**: Uses React Router's `useNavigate()` hook. When a user creates a new meeting, it generates a random alphanumeric hash locally (e.g., `xyz987`) and pushes the URL logic straight into the Room component endpoint.
- **`Room.jsx`**: The most critical page. 
  1. Requests permission via `navigator.mediaDevices.getUserMedia()`.
  2. Creates a local `<video>` element to preview your webcam immediately.
  3. Uses `socket.io-client` to tell the backend "I am here in this virtual room".
  4. Generates an array of `simple-peer` instances for every other single user already present, drawing individual `<video>` frames dynamically onto the CSS Grid layout.

---

## 5. Backend Logic Breakdown (`server.js`)
- **Express Core (REST APIs):** Standard HTTP routes process static data. When the frontend asks to register a user, Express handles the POST request, hashes the password inside the `User` Model file via `bcrypt`, saves it, and responds with a JSON success payload.
- **Socket.io Core (Real-Time Engine):** Intertwined directly into the Express `http.createServer()`. It maintains an active web socket connection in memory with all connected browser clients. 
- **The "Mesh" Tracker:** The server maintains an object `const users = {}` acting as an ongoing ledger tracking which unique `socket.id` currently belongs to which specific `roomId`. When someone disconnects, it scrubs their ID from the ledger and broadcasts to the remaining participants to delete that user's frozen video square.

---

## 6. How to Setup the Database Later
Because our application is fully coded to anticipate MongoDB, you strictly need it running before the `node server.js` boot command works safely.

### Path A: Use MongoDB Atlas (Cloud - Recommended)
The fastest approach ensuring you don't have to install heavy database software locally.
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and register a free account.
2. Create a "Free Tier M0 Cluster".
3. Under "Database Access", create a Database User with a username and password.
4. Under "Network Access", allow IP Address `0.0.0.0/0` (Allows connection from anywhere).
5. Click "Connect" -> "Connect your application", and copy the generated **URI String**.
6. Open your `e:\KConnect\backend\.env` file and replace the `MONGO_URI` variable:
   `MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/kconnect`
7. Start your backend! Everything will sync specifically to the cloud securely!

### Path B: Install MongoDB Locally
If you want total offline control on your exact Windows machine:
1. Download the [MongoDB Community Server](https://www.mongodb.com/try/download/community) specifically for Windows.
2. Run the `.msi` setup installer. Keep all settings on "Complete / Default" (Ensures `MongoDB Compass` installs as a GUI viewer).
3. Once fully installed, it automatically runs continually as a behind-the-scenes Windows Background Service on port `27017`.
4. Our current `backend/.env` file is already perfectly configured to target this setup:
   `MONGO_URI=mongodb://127.0.0.1:27017/kconnect`
5. Start your backend! Open "MongoDB Compass" application to visualize the users the app creates for you manually.
