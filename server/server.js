const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? ['https://your-netlify-app.netlify.app']  // Replace with your Netlify URL
            : ['http://localhost:3000'],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const cors = require('cors');

// Enable CORS
app.use(cors());


const path = require('path');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const users = new Map();
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('register', (userData) => {
        const { userId, profile } = userData;
        activeUsers.set(userId, socket.id);
        users.set(userId, {
            ...profile,
            userId,
            lastSeen: new Date(),
            status: 'online'
        });
        console.log(`User registered: ${userId}`);
        io.emit('userList', Array.from(users.values()));
    });

    // Updated private message handling
    socket.on('privateMessage', (data) => {
        console.log('Private message received:', data);
        const recipientSocketId = activeUsers.get(data.recipientId);
        
        if (recipientSocketId) {
            // Send to recipient
            io.to(recipientSocketId).emit('privateMessage', {
                senderId: data.senderId,
                senderProfile: data.senderProfile,
                message: data.message,
                timestamp: new Date()
            });
        }
    });

    socket.on('typing', (data) => {
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('userTyping', {
                senderId: data.senderId,
                isTyping: data.isTyping
            });
        }
    });

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
                    status: 'offline' 
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