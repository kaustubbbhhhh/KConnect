const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Load env vars
dotenv.config();

const app = express();

// Create HTTP server for Socket.io
const server = http.createServer(app);

const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5176';

// Flexible CORS for dev and production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (same-origin requests, mobile apps, curl)
    if (!origin) return callback(null, true);
    
    const isLocalhost = origin.startsWith('http://localhost:');
    const isLocalIP = origin.startsWith('http://192.168.') || origin.startsWith('http://10.');
    const isCloudRun = origin.endsWith('.run.app');
    
    if (isLocalhost || isLocalIP || isCloudRun || origin === frontendURL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

// Initialize Socket.io with aggressive keep-alive to survive Cloud Run timeouts
const io = new Server(server, {
  cors: corsOptions,
  pingInterval: 25000,   // Send a ping every 25 seconds
  pingTimeout: 20000,    // Wait 20 seconds for a pong before considering disconnected
  transports: ['websocket', 'polling']  // Prefer WebSocket, fallback to polling
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: false }));

// Connect to MongoDB with retry logic for Cloud Run cold starts
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,  // Wait 30s for MongoDB Atlas to respond
      socketTimeoutMS: 45000,           // Close sockets after 45s of inactivity
      bufferCommands: true,             // Buffer commands while connecting
      maxPoolSize: 10,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Retry after 5 seconds
    setTimeout(connectDB, 5000);
  }
};
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/meetings', require('./routes/meetings'));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../dist')));

  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
  });
} else {
  // Basic route
  app.get('/', (req, res) => {
      res.send('KConnect API Running');
  });
}

// TURN Server Credentials Route
app.get('/api/turn', async (req, res) => {
    try {
        const domain = process.env.METERED_DOMAIN;
        const apiKey = process.env.METERED_API_KEY;
        if (!domain || !apiKey) {
            return res.status(500).json({ error: 'Metered credentials not configured in backend' });
        }
        const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
        const iceServers = await response.json();
        res.json(iceServers);
    } catch (error) {
        console.error('Error fetching TURN credentials:', error);
        res.status(500).json({ error: 'Failed to fetch TURN credentials' });
    }
});

// =========================================
// Socket.io WebRTC Signaling Logic
// =========================================

// Room state maps
const rooms = {};        // roomId -> [{ socketId, userId, username, isHost }]
const pendingUsers = {};  // roomId -> [{ socketId, userId, username }]
const socketToRoom = {};  // socketId -> roomId
const socketToUser = {};  // socketId -> { userId, username }

function getRoomUsers(roomId) {
    return rooms[roomId] || [];
}

function getPendingUsers(roomId) {
    return pendingUsers[roomId] || [];
}

function removeUserFromRoom(roomId, socketId) {
    if (!rooms[roomId]) return;
    rooms[roomId] = rooms[roomId].filter(u => u.socketId !== socketId);
    if (rooms[roomId].length === 0) {
        delete rooms[roomId];
    }
}

function removeUserFromPending(roomId, socketId) {
    if (!pendingUsers[roomId]) return;
    pendingUsers[roomId] = pendingUsers[roomId].filter(u => u.socketId !== socketId);
    if (pendingUsers[roomId].length === 0) {
        delete pendingUsers[roomId];
    }
}

function findHostSocket(roomId) {
    const roomUsers = getRoomUsers(roomId);
    const host = roomUsers.find(u => u.isHost);
    return host ? host.socketId : null;
}

io.on('connection', socket => {
    console.log('Socket connected:', socket.id);

    // ---- ADMIT FLOW: Non-host requests admission ----
    socket.on('request admission', ({ roomId, username, userId }) => {
        // NOTE: Do NOT socket.join(roomId) here — user is not admitted yet.
        // We only track them in pending list and message them directly by socket.id.
        socketToRoom[socket.id] = roomId;
        socketToUser[socket.id] = { userId, username };

        if (!pendingUsers[roomId]) pendingUsers[roomId] = [];
        // Remove any stale entry for this userId
        pendingUsers[roomId] = pendingUsers[roomId].filter(u => u.userId !== userId);
        pendingUsers[roomId].push({ socketId: socket.id, userId, username });

        // Notify host directly (not via room broadcast)
        const hostSocketId = findHostSocket(roomId);
        if (hostSocketId) {
            io.to(hostSocketId).emit('admission request', {
                socketId: socket.id,
                userId,
                username
            });
            // Also send full pending list
            io.to(hostSocketId).emit('pending list', getPendingUsers(roomId));
        }
    });

    // ---- HOST ADMITS a user ----
    socket.on('admit user', ({ roomId, targetSocketId }) => {
        // Verify sender is host
        const roomUsers = getRoomUsers(roomId);
        const sender = roomUsers.find(u => u.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        const pending = getPendingUsers(roomId);
        const userToAdmit = pending.find(u => u.socketId === targetSocketId);
        if (!userToAdmit) return;

        // Remove from pending
        removeUserFromPending(roomId, targetSocketId);

        // Tell the admitted user they're in
        io.to(targetSocketId).emit('admitted');

        // Send updated pending list to host
        io.to(socket.id).emit('pending list', getPendingUsers(roomId));
    });

    // ---- HOST DENIES a user ----
    socket.on('deny user', ({ roomId, targetSocketId }) => {
        const roomUsers = getRoomUsers(roomId);
        const sender = roomUsers.find(u => u.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        removeUserFromPending(roomId, targetSocketId);

        io.to(targetSocketId).emit('denied');
        io.to(socket.id).emit('pending list', getPendingUsers(roomId));
    });

    // ---- JOIN ROOM (after admission or host self-join) ----
    socket.on('join room', ({ roomId, username, userId, isHost }) => {
        socket.join(roomId);

        const newUser = { socketId: socket.id, userId, username: username || 'Anonymous', isHost: !!isHost };
        socketToUser[socket.id] = { userId, username: username || 'Anonymous' };
        socketToRoom[socket.id] = roomId;

        if (!rooms[roomId]) rooms[roomId] = [];

        // CRITICAL: Deduplicate by userId — remove old socket entry for same user
        const oldEntry = rooms[roomId].find(u => u.userId === userId && u.socketId !== socket.id);
        if (oldEntry) {
            console.log(`Dedup: removing old socket ${oldEntry.socketId} for user ${userId}`);
            // Tell everyone the old socket left
            rooms[roomId].forEach(u => {
                if (u.socketId !== oldEntry.socketId && u.socketId !== socket.id) {
                    io.to(u.socketId).emit('user left', oldEntry.socketId);
                }
            });
            rooms[roomId] = rooms[roomId].filter(u => u.socketId !== oldEntry.socketId);
            delete socketToRoom[oldEntry.socketId];
            delete socketToUser[oldEntry.socketId];
        }

        // Also remove if this exact socketId is already in the room (reconnect case)
        rooms[roomId] = rooms[roomId].filter(u => u.socketId !== socket.id);
        rooms[roomId].push(newUser);

        // Send existing users to the new joiner (excluding self)
        const usersInThisRoom = rooms[roomId].filter(u => u.socketId !== socket.id);
        socket.emit('all users', usersInThisRoom);

        // Notify everyone about the updated participant list
        io.to(roomId).emit('participants list', rooms[roomId]);

        // Send pending list to host if they just joined
        if (isHost) {
            io.to(socket.id).emit('pending list', getPendingUsers(roomId));
        }
    });

    // ---- WebRTC signaling ----
    socket.on('sending signal', payload => {
        io.to(payload.userToSignal).emit('user joined', {
            signal: payload.signal,
            callerID: payload.callerID,
            callerName: socketToUser[socket.id]?.username || 'Anonymous'
        });
    });

    socket.on('returning signal', payload => {
        io.to(payload.callerID).emit('receiving returned signal', {
            signal: payload.signal,
            id: socket.id,
            responderName: socketToUser[socket.id]?.username || 'Anonymous'
        });
    });

    // ---- KICK USER ----
    socket.on('kick user', ({ roomId, targetSocketId }) => {
        const roomUsers = getRoomUsers(roomId);
        const sender = roomUsers.find(u => u.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        // Notify the kicked user
        io.to(targetSocketId).emit('you were kicked');

        // Remove from room
        removeUserFromRoom(roomId, targetSocketId);

        // Tell others
        roomUsers.forEach(u => {
            if (u.socketId !== targetSocketId) {
                io.to(u.socketId).emit('user left', targetSocketId);
            }
        });

        // Update participant list
        io.to(roomId).emit('participants list', getRoomUsers(roomId));

        delete socketToRoom[targetSocketId];
        delete socketToUser[targetSocketId];
    });

    // ---- DISCONNECT ----
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        const roomId = socketToRoom[socket.id];

        // Remove from pending if they were waiting
        if (roomId) {
            removeUserFromPending(roomId, socket.id);
            // Notify host about updated pending list
            const hostSocketId = findHostSocket(roomId);
            if (hostSocketId) {
                io.to(hostSocketId).emit('pending list', getPendingUsers(roomId));
            }
        }

        // Remove from active room
        if (roomId && rooms[roomId]) {
            removeUserFromRoom(roomId, socket.id);

            // Tell remaining users
            const remaining = getRoomUsers(roomId);
            remaining.forEach(u => {
                io.to(u.socketId).emit('user left', socket.id);
            });

            // Update participant list
            io.to(roomId).emit('participants list', remaining);
        }

        delete socketToRoom[socket.id];
        delete socketToUser[socket.id];
    });

    // ---- LEAVE ROOM (explicit, before disconnect) ----
    socket.on('leave room', () => {
        const roomId = socketToRoom[socket.id];
        if (!roomId) return;

        console.log(`User explicitly leaving room: ${socket.id} from ${roomId}`);

        // Remove from pending if they were waiting
        removeUserFromPending(roomId, socket.id);
        const hostSocketId = findHostSocket(roomId);
        if (hostSocketId) {
            io.to(hostSocketId).emit('pending list', getPendingUsers(roomId));
        }

        // Remove from active room
        removeUserFromRoom(roomId, socket.id);

        // Leave the socket.io room
        socket.leave(roomId);

        // Tell remaining users
        const remaining = getRoomUsers(roomId);
        remaining.forEach(u => {
            io.to(u.socketId).emit('user left', socket.id);
        });

        // Update participant list
        io.to(roomId).emit('participants list', remaining);

        delete socketToRoom[socket.id];
        delete socketToUser[socket.id];
    });

    // ---- MUTE / VIDEO TOGGLE BROADCAST ----
    socket.on('toggle mute', ({ isMuted }) => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            socket.to(roomId).emit('user toggled mute', { socketId: socket.id, isMuted });
        }
    });

    socket.on('toggle video', ({ isVideoOff }) => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            socket.to(roomId).emit('user toggled video', { socketId: socket.id, isVideoOff });
        }
    });

    // ---- CHAT ----
    socket.on('send message', (payload) => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            io.to(roomId).emit('new message', payload);
        }
    });

    // ---- END MEETING ----
    socket.on('end meeting', (roomId) => {
        io.to(roomId).emit('meeting ended');
        // Clear room state
        delete rooms[roomId];
        delete pendingUsers[roomId];
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
