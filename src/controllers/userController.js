// src/controllers/userController.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma'); // ajuste conforme sua importação
const { sendMail } = require('../helpers/mailer');
const { success, fail } = require('../helpers/responseHelper');

const SALT_ROUNDS = 10;

// ==================== REGISTRO DE USUÁRIO ====================
async function registerUser(req, res, next) {
  try {
    const { nome, email, password } = req.body;
    if (!nome || !email || !password)
      return fail(res, 'Preencha todos os campos', 400);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(res, 'E-mail já cadastrado', 400);

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { nome, email, password: hashed },
    });

    return success(res, user, 'Usuário registrado com sucesso');
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

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return success(res, { id: user.id, nome: user.nome, email: user.email }, 'Login realizado com sucesso', token);
  } catch (err) {
    next(err);
  }
}

// ==================== LISTAR USUÁRIOS ====================
async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, nome: true, email: true },
    });
    return success(res, users, 'Lista de usuários');
  } catch (err) {
    next(err);
  }
}

// ==================== DADOS DO USUÁRIO LOGADO ====================
async function getMe(req, res, next) {
  try {
    const userId = req.userId; // definido pelo middleware auth
    if (!userId) return fail(res, 'Usuário não autenticado', 401);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, email: true },
    });
    if (!user) return fail(res, 'Usuário não encontrado', 404);

    return success(res, user);
  } catch (err) {
    next(err);
  }
}

// ==================== ESQUECI SENHA ====================
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, 'E-mail não encontrado', 404);

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: expires },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Recuperação de senha',
      html: `<p>Para redefinir sua senha, clique <a href="${resetUrl}">aqui</a>.</p>`,
    });

    return success(res, null, 'E-mail de recuperação enviado');
  } catch (err) {
    next(err);
  }
}

// ==================== RESET DE SENHA ====================
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gte: new Date() } },
    });
    if (!user) return fail(res, 'Token inválido ou expirado', 400);

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpires: null },
    });

    return success(res, null, 'Senha redefinida com sucesso');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerUser,
  loginUser,
  listUsers,
  getMe,
  forgotPassword,
  resetPassword,
};
