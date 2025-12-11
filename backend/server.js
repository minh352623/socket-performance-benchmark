const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { encode } = require('@msgpack/msgpack');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for demo
    methods: ["GET", "POST"]
  }
});

// Generate a large dataset (~1000 items)
const generateData = () => {
  const data = [];
  for (let i = 0; i < 5000; i++) {
    data.push({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      bio: `This is a bio for user ${i}. It contains some random text to increase the payload size. Lorem ipsum dolor sit amet.`,
      active: i % 2 === 0,
      roles: ['user', 'editor', 'viewer'],
      metadata: {
        lastLogin: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          notifications: true
        }
      }
    });
  }
  return data;
};

const largeDataset = generateData();

console.log(`Generated dataset with ${largeDataset.length} items.`);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('request-json', () => {
    console.log(`[${socket.id}] requested JSON`);
    // Send as pure JSON object
    socket.emit('response-json', largeDataset);
  });

  socket.on('request-buffer', () => {
    console.log(`[${socket.id}] requested Buffer`);
    // Encode to msgpack Buffer
    const buffer = encode(largeDataset);
    socket.emit('response-buffer', buffer);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
