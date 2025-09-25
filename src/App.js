require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const prisma = require('./prismaClient');

const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');

// Create app
const app = express();
let server; // Declare server in a wider scope

// Middleware
app.use(helmet());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Routes
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/measurements', measurementsRouter);

// Healthcheck route
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

// Graceful shutdown function
async function shutdown(signal) {
  try {
    console.log(`Recebido ${signal}, finalizando...`);
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Erro no shutdown:', e);
    process.exit(1);
  }
}

// Process event handlers for graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

// Start the server
const PORT = process.env.PORT || 3000;
server = app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});

module.exports = app;