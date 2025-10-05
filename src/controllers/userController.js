const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client'); // ← IMPORT DIRETO
const jwt = require('jsonwebtoken');

// Crie a instância do Prisma DIRETAMENTE aqui
const prisma = new PrismaClient();

// Funções de resposta (caso o helpers não exista)
const success = (res, data, message = 'Success') => {
  return res.json({ success: true, data, message });
};

const fail = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error });
};

// ==================== REGISTRO DE USUÁRIO ====================
async function registerUser(req, res, next) {
  try {
    console.log('✅ registerUser chamado!');
    console.log('📥 Dados:', req.body);
    
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return fail(res, 'Preencha todos os campos', 400);
    }

    if (!["RESIDENTIAL", "BUSINESS"].includes(role)) {
      return fail(res, 'Role inválido', 400);
    }

    // TESTE: Verifique se o Prisma funciona
    console.log('🔍 Testando conexão com Prisma...');
    const userCount = await prisma.user.count();
    console.log(`📊 Total de usuários: ${userCount}`);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(res, 'E-mail já cadastrado', 400);

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
    });

    console.log('✅ Usuário criado:', user.id);
    
    return success(res, { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    }, 'Usuário registrado com sucesso');
    
  } catch (err) {
    console.error('❌ Erro NOVO no registerUser:', err);
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

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'segredo', { expiresIn: '7d' });

    return success(res, { id: user.id, name: user.name, email: user.email, role: user.role, token }, 'Login realizado com sucesso');
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

// ==================== PEGAR QUALQUER USUÁRIO (SEM AUTH) ====================
async function getMe(req, res, next) {
  try {
    // Pega o primeiro usuário do banco para teste
    const user = await prisma.user.findFirst({
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return fail(res, 'Nenhum usuário encontrado', 404);

    return success(res, user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerUser,
  loginUser,
  listUsers,
  getMe,
};
