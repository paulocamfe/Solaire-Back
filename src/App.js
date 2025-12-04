require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./helpers/logger');
const prisma = require('./prismaClient');
const { WebSocketServer } = require('ws');

// =================== ROTAS ===================
const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');
const newsletterRouter = require('./Routes/newsletterRoutes');
const companyRoutes = require('./Routes/companyRoutes');
const branchRoutes = require('./Routes/branchRoutes');
const authRoutes = require('./Routes/authRoutes'); 
const esp32Routes = require('./Routes/esp32Routes');
const supportRoutes = require('./Routes/supportRoutes');
const { setBroadcastFunction } = require('./controllers/esp32Controller');

let paymentRoutes;
try {
  paymentRoutes = require('./Routes/paymentRoutes');
} catch (e) {
  paymentRoutes = null;
}

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// =================== SWAGGER ===================
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Solaire API', version: '1.0.0' },
  },
  apis: ['./Routes/*.js'],
});

const app = express();
let server;
let wss; // WebSocket server

// =================== MIDDLEWARE ===================
app.use(helmet());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// =================== CORS ===================
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) || [];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) => origin.includes(allowed));
      if (isAllowed) return callback(null, true);
      console.warn(`🚫 CORS bloqueou origem: ${origin}`);
      return callback(new Error('CORS bloqueou esta origem.'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// =================== SWAGGER ===================
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// =================== ROTAS ===================
app.use('/auth', authRoutes);
if (paymentRoutes) app.use('/payments', paymentRoutes);
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/measurements', measurementsRouter);
app.use('/newsletter', newsletterRouter);
app.use('/companies', companyRoutes);
app.use('/branches', branchRoutes);
app.use('/esp32', esp32Routes);
app.use('/support', supportRoutes);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Not Found' }));

// Error handler
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS bloqueou')) {
    return res.status(403).json({ success: false, error: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erro interno',
    type: err.name || 'InternalError',
  });
});

// =================== SHUTDOWN ===================
async function shutdown(signal) {
  logger.info(`Recebido ${signal}, finalizando...`);
  try {
    if (server) {
      server.close(() => logger.info('Servidor encerrado.'));
    }
    if (wss) {
      wss.close(() => logger.info('WebSocket encerrado.'));
    }
    await prisma.$disconnect();
    logger.info('Conexão Prisma encerrada com sucesso.');
    process.exit(0);
  } catch (e) {
    logger.error('Erro no shutdown:', e);
    process.exit(1);
  }
}

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

// =================== START SERVER COM WEBSOCKET ===================
const PORT = process.env.PORT || 3333;
server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`✅ API rodando em http://0.0.0.0:${PORT}`);

  // Inicializa WebSocket server
  wss = new WebSocketServer({ 
    server,
    perMessageDeflate: false,
  });

  wss.on('connection', (ws) => {
    console.log('📱 [WS] Cliente conectado! Total:', wss.clients.size);

    ws.on('message', (msg) => {
      console.log('📨 [WS] Mensagem recebida:', msg.toString());
    });

    ws.on('close', () => {
      console.log('❌ [WS] Cliente desconectado. Restante:', wss.clients.size);
    });

    ws.on('error', (err) => {
      console.error('⚠️ [WS] Erro:', err.message);
    });
  });

  // Injeta a função broadcast no controller
  setBroadcastFunction((data) => {
    if (wss) {
      let count = 0;
      for (const client of wss.clients) {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify(data));
          count++;
        }
      }
      console.log(`📤 [WS] Broadcast enviado para ${count} cliente(s)`);
    }
  });

  console.log('🔌 [WS] WebSocket server pronto!');
});

module.exports = app;