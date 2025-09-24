require('dotenv').config();
const express = require("express");
const cors = require("cors");
const prisma = require('./prismaClient'); // Cliente Prisma centralizado

// Importar routers
const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');

// Criar app
const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ---------------- ROTAS ----------------
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/measurements', measurementsRouter);

// ---------------- MIDDLEWARE DE ERRO CENTRALIZADO ----------------
app.use((err, req, res, next) => {
  console.error('Erro central:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

// ---------------- SHUTDOWN GRACIOSO ----------------
async function shutdown(signal) {
  try {
    console.log(`Recebido ${signal}. Finalizando servidor...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Erro no shutdown:', e);
    process.exit(1);
  }
}

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

// ---------------- INICIAR SERVIDOR ----------------
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
