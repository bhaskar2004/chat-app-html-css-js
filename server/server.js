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

// Basic route for checking if server is running
app.get('/', (req, res) => {
    res.send('Chat server is running');
});

// Rest of your server code remains the same
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');
    // Your existing socket event handlers...
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});