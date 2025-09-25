require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const prisma = require('./prismaClient'); // use prismaClient central

// routers (mova sua lógica para controllers + Routes/*)
const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');

const app = express();

// Segurança e logs
app.use(helmet());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Rotas (centralizadas)
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/measurements', measurementsRouter);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Error handler centralizado
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});


async function shutdown(signal) {
  try {
    console.log(`Recebido ${signal}, finalizando...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Erro no shutdown:', e);
    process.exit(1);
  }
}

/*------------------------*/
require('dotenv').config({ debug: false });
/*------------------------*/


process.on('SIGINT', () => shutdown('SIGINT')); /* fechar a aplicção de forma segura*/    
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {    /* é um manipulador de eventos no Node.js que atua como último recurso para capturar erros que não foram tratados em nenhuma outra 
                                              parte da sua aplicação.  Quando uma exceção, ou erro, ocorre e não é capturada por um bloco try...catch,
                                             o processo do Node.js normalmente travaria. Este manipulador evita essa falha imediata, dando a você a chance de realizar um encerramento limpo.*/ 
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});


// Start + graceful shutdown
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));

module.exports = app;