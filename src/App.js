require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();
const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(express.json());

app.use(cors({
  origin: "http://localhost:8081",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const SECRET = process.env.JWT_SECRET || "defaultsecret";

// ---------------- MIDDLEWARE DE AUTENTICAÇÃO ----------------
function autenticar(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Token necessário" });

  const token = authHeader.split(" ")[1]; // formato "Bearer token"
  if (!token) return res.status(401).json({ error: "Token inválido" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token inválido ou expirado" });
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
});
