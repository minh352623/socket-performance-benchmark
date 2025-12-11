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

// Generate a large dataset
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

// Optimization: "as_array" - Convert object to array (tuple) to remove keys
const userAsArray = (user) => {
  return [
    user.id,
    user.name,
    user.email,
    user.bio,
    user.active,
    user.roles,
    [ // metadata as nested array
      user.metadata.lastLogin,
      [ // preferences
        user.metadata.preferences.theme,
        user.metadata.preferences.notifications
      ]
    ]
  ];
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('request-json', () => {
    console.log(`[${socket.id}] requested JSON`);
    socket.emit('response-json', largeDataset);
  });

  socket.on('request-buffer', () => {
    console.log(`[${socket.id}] requested Buffer (Optimized as_array)`);
    // Map dataset to array structure
    const optimizedDataset = largeDataset.map(userAsArray);
    // Encode the array of arrays
    const buffer = encode(optimizedDataset);
    socket.emit('response-buffer', buffer);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ETag Demo Data
const crypto = require('crypto');
const etagData = "A".repeat(500 * 1024); // 500KB of text
const etagHash = crypto.createHash('md5').update(etagData).digest('hex');

// Disable default Etags
app.set('etag', false);

app.get('/api/etag-demo', (req, res) => {
  const ifNoneMatch = req.headers['if-none-match'];

  console.log(`[${req.ip}] Request ETag Demo. Client ETag: ${ifNoneMatch}, Server ETag: "${etagHash}"`);

  if (ifNoneMatch === `"${etagHash}"`) {
    console.log('ETag matched! Sending 304');
    return res.status(304).end();
  }

  console.log('ETag not matched. Sending 200');
  res.setHeader('ETag', `"${etagHash}"`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(etagData);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
