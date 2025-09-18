require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ...existing code...
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./prismaClient'); // usar cliente Prisma central

const usersRouter = require('./Routes/userRoutes');
const panelsRouter = require('./Routes/panelRoutes');
const measurementsRouter = require('./Routes/measurementRoutes');

const app = express();

// Middleware
app.use(express.json());


app.use(cors({
  origin: "http://localhost:8081",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const SECRET = process.env.JWT_SECRET || "defaultsecret";

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Montar routers (rotas agora estão nos arquivos em src/Routes)
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/measurements', measurementsRouter);

// Middleware de erro centralizado
app.use((err, req, res, next) => {
  console.error('Erro central:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

// Iniciar servidor com shutdown gracioso
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});

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

// ---------------- ROTAS ----------------

// Cadastro de usuário
app.post("/users", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "E-mail já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    res.status(201).json({ message: "Usuário criado com sucesso", userId: user.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar usuários
app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
    });
    res.json(users);
  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Senha inválida" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login bem-sucedido", token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rota /users/me - dados do usuário logado + placas vinculadas
app.get("/users/me", autenticar, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        panels: { select: { id: true, serial: true } } // placas vinculadas
      },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    res.json(user);
  } catch (err) {
    console.error("Erro ao buscar usuário logado:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Vincular placa ao usuário
app.post("/panels/link", autenticar, async (req, res) => {
  const { userId, serial } = req.body;
  try {
    const panel = await prisma.panel.update({
      where: { serial },
      data: { userId },
    });
    res.json(panel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Registrar medição
app.post("/measurements", autenticar, async (req, res) => {
  const { panelId, voltage, current, power, temperature, consumption, status } = req.body;
  try {
    const measurement = await prisma.measurement.create({
      data: { panelId, voltage, current, power, temperature, consumption, status },
    });
    res.json(measurement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar medições de uma placa
app.get("/panels/:panelId/measurements", autenticar, async (req, res) => {
  const { panelId } = req.params;
  try {
    const measurements = await prisma.measurement.findMany({
      where: { panelId: Number(panelId) },
    });
    res.json(measurements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- INICIAR SERVIDOR ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
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
