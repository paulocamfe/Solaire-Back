require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./helpers/logger');
const { prisma } = require('./prismaClient');


// --- ROTAS ---
const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');
const newsletterRouter = require('./Routes/newsletterRoutes');
const companyRoutes = require('./Routes/companyRoutes');
const branchRoutes = require('./Routes/branchRoutes');

// Swagger
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Solaire API', version: '1.0.0' },
  },
  apis: ['./Routes/*.js'],
});

const app = express();
let server;

// ================= MIDDLEWARE =================
app.use(helmet());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

app.use(express.json());

// ================= CORS CONFIGURATION (CORRECTED) =================
// Lista de URLs que podem fazer requisições à sua API
const allowedOrigins = [
  'http://localhost:3000', // URL do seu Next.js em desenvolvimento
  process.env.FRONTEND_URL, // URL do seu site em produção (lida do .env)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite requisições sem 'origin' (como Postman)
      if (!origin) return callback(null, true);
      
      // Se a origem da requisição estiver na nossa lista de permissões, permita
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'A política de CORS para este site não permite acesso da Origem especificada.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);


// ================= SWAGGER =================
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ================= ROTAS =================
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/measurements', measurementsRouter);
app.use('/newsletter', newsletterRouter);
app.use('/companies', companyRoutes);
app.use('/branches', branchRoutes);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Not Found' }));

// Error handler simples
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erro interno',
    type: err.name || 'InternalError',
  });
});

// ================= SHUTDOWN =================
async function shutdown(signal) {
  logger.info(`Recebido ${signal}, finalizando...`);
  try {
    if (server) {
      server.close(() => {
        logger.info('Servidor encerrado.');
      });
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
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3333;
server = app.listen(PORT, () => {
  logger.info(`API rodando na porta ${PORT}`);
});

module.exports = app;