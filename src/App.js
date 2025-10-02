require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const prisma = require('./prismaClient');
const logger = require('./helpers/logger');

const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');

// Swagger setup for API documentation
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Solaire API', version: '1.0.0' },
  },
  apis: ['./src/Routes/*.js'],
});

// Create app
const app = express();
let server;

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

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
  logger.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erro interno',
    type: err.name || 'InternalError'
  });
});

// Graceful shutdown function
async function shutdown(signal) {
  try {
    logger.info(`Recebido ${signal}, finalizando...`);
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    logger.error('Erro no shutdown:', e);
    process.exit(1);
  }
}

// Process event handlers for graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

// Start the server
const PORT = process.env.PORT || 3000;
server = app.listen(PORT, () => {
  logger.info(`API rodando na porta ${PORT}`);
});

const newsletterRouter = require('./Routes/newsletterRoutes');
app.use('/newsletter', newsletterRouter);

module.exports = app;