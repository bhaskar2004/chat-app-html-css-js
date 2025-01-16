const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const http = require('http').createServer(app);

const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://cloud77.netlify.app'] // Replace with your Netlify URL
    : ['http://localhost:3000'];

// Enable CORS
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
}));

// Handle preflight requests explicitly
app.options('*', cors());

const io = require('socket.io')(http, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
});

const PORT = process.env.PORT || 3000;

// Basic Routes
app.get('/', (req, res) => {
    res.send('Chat server is running');
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const users = new Map();
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle user registration
    socket.on('register', (userData) => {
        const { userId, profile } = userData;
        activeUsers.set(userId, socket.id);
        users.set(userId, {
            ...profile,
            userId,
            lastSeen: new Date(),
            status: 'online',
        });
        console.log(`User registered: ${userId}`);
        io.emit('userList', Array.from(users.values()));
    });

    // Handle private messaging
    socket.on('privateMessage', (data) => {
        console.log('Private message received:', data);
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('privateMessage', {
                senderId: data.senderId,
                senderProfile: data.senderProfile,
                message: data.message,
                timestamp: new Date(),
            });
        }
    });

    // Handle typing indication
    socket.on('typing', (data) => {
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('userTyping', {
                senderId: data.senderId,
                isTyping: data.isTyping,
            });
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        let disconnectedUser;
        for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
                disconnectedUser = userId;
                break;
            }
        }

        if (disconnectedUser) {
            const user = users.get(disconnectedUser);
            if (user) {
                user.status = 'offline';
                user.lastSeen = new Date();
                io.emit('userStatusUpdate', {
                    userId: disconnectedUser,
                    status: 'offline',
                });
            }
            activeUsers.delete(disconnectedUser);
        }
        console.log('User disconnected');
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
