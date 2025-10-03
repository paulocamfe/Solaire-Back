const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prismaClient');
const { sendMail } = require('../helpers/mailer');
const { success, fail } = require('../helpers/response');

const SALT_ROUNDS = 10;

// ==================== REGISTRO DE USUÁRIO ====================
async function registerUser(req, res, next) {
  try {
    const { nome, email, password, tipo_conta } = req.body;

    // Verifica campos obrigatórios
    if (!nome || !email || !password || !tipo_conta) {
      return fail(res, 'Preencha todos os campos', 400);
    }

    // Verifica se o tipo de conta é válido
    if (!["residencial", "empresarial"].includes(tipo_conta)) {
      return fail(res, 'Tipo de conta inválido', 400);
    }

    // Checa se email já existe
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(res, 'E-mail já cadastrado', 400);

    // Criptografa a senha
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Cria usuário no banco com tipo de conta
    const user = await prisma.user.create({
      data: { nome, email, password: hashed, tipo_conta },
    });

    // Retorna sucesso
    return success(
      res,
      { id: user.id, nome: user.nome, email: user.email, tipo_conta: user.tipo_conta },
      'Usuário registrado com sucesso'
    );

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
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return success(res, {
      id: user.id,
      nome: user.nome,
      email: user.email,
      tipo_conta: user.tipo_conta, // ✅ retorna o tipo da conta
      token
    }, 'Login realizado com sucesso');

  } catch (err) {
    next(err);
  }
}

// ==================== LISTAR USUÁRIOS ====================
async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, nome: true, email: true, tipo_conta: true }, // ✅ inclui tipo_conta
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
      select: { id: true, nome: true, email: true, tipo_conta: true }, // ✅ inclui tipo_conta
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
