const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Funções de resposta
const success = (res, data, message = 'Success') => {
  return res.json({ success: true, data, message });
};

const fail = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error });
};

// ==================== REGISTRO DE USUÁRIO ====================
async function registerUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return fail(res, 'Preencha todos os campos', 400);
    }

    if (!["RESIDENTIAL", "BUSINESS"].includes(role)) {
      return fail(res, 'Role inválido', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(res, 'E-mail já cadastrado', 400);

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
    });

    return success(res, { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    }, 'Usuário registrado com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== LOGIN ====================
async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Preencha todos os campos', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, 'Usuário não encontrado', 404);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return fail(res, 'Senha inválida', 401);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'segredo',
      { expiresIn: '7d' }
    );

    return success(res, { id: user.id, name: user.name, email: user.email, role: user.role, token }, 'Login realizado com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== PEGAR USUÁRIO LOGADO (COM AUTH) ====================
async function getMe(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, error: 'Token inválido ou usuário não autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return fail(res, 'Usuário não encontrado', 404);

    return success(res, user, 'Usuário autenticado com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== LISTAR USUÁRIOS ====================
async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
    });
    return success(res, users, 'Lista de usuários');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerUser,
  loginUser,
  getMe,
  listUsers,
};
