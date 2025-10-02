const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const JWT_SECRET = process.env.JWT_SECRET || 'insecure_secret_fallback';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h';

if (JWT_SECRET === 'insecure_secret_fallback' && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET não definido em produção. Configure process.env.JWT_SECRET');
}

/**
 * POST /users
 */
async function registerUser(req, res, next) {
  try {
    const name = req.body.name && String(req.body.name).trim();
    const email = req.body.email && String(req.body.email).trim().toLowerCase();
    const password = req.body.password && String(req.body.password);
    const role = req.body.role === 'BUSINESS' ? 'BUSINESS' : 'RESIDENTIAL';
    const cpf = req.body.cpf && String(req.body.cpf).replace(/\D/g, '');
    const cnpj = req.body.cnpj && String(req.body.cnpj).replace(/\D/g, '');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email e password são obrigatórios' });
    }

    if (role === 'RESIDENTIAL') {
      if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório para contas residenciais' });
      if (cpf.length !== 11) return res.status(400).json({ error: 'CPF inválido' });
    }
    if (role === 'BUSINESS') {
      if (!cnpj) return res.status(400).json({ error: 'CNPJ é obrigatório para contas empresariais' });
      if (cnpj.length !== 14) return res.status(400).json({ error: 'CNPJ inválido' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(cpf ? [{ cpf }] : []),
          ...(cnpj ? [{ cnpj }] : []),
        ],
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'E-mail, CPF ou CNPJ já cadastrado' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        cpf: role === 'RESIDENTIAL' ? cpf : null,
        cnpj: role === 'BUSINESS' ? cnpj : null,
      },
      select: { id: true, name: true, email: true, role: true, cpf: true, cnpj: true },
    });

    return res.status(201).json({ message: 'Usuário criado com sucesso', user });
  } catch (err) {
    next(err);
  }
}


/**
 * GET /users?page=1&limit=50
 */
async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      prisma.user.count(),
    ]);

    return res.json({
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
      data: users,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /users/login
 */

async function loginUser(req, res, next) {
  try {
    const email = req.body.email && String(req.body.email).trim().toLowerCase();
    const password = req.body.password && String(req.body.password);

    if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.json({
      message: 'Login bem-sucedido',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cpf: user.cpf,
        cnpj: user.cnpj,
      },
    });
  } catch (err) {
    next(err);
  }
}


/**
 * GET /users/me
 */

async function getMe(req, res, next) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, cpf: true, cnpj: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.json(user);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  registerUser,
  listUsers,
  loginUser,
  getMe,
};