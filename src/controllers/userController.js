const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { success, fail } = require('../helpers/response');
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const JWT_SECRET = process.env.JWT_SECRET || 'insecure_secret_fallback';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h';
const Joi = require('joi');

if (JWT_SECRET === 'insecure_secret_fallback' && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET não definido em produção. Configure process.env.JWT_SECRET');
}

const userSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  role: Joi.string().valid('RESIDENTIAL', 'BUSINESS').default('RESIDENTIAL'),
  cpf: Joi.string().length(11).pattern(/^\d+$/).when('role', { is: 'RESIDENTIAL', then: Joi.required(), otherwise: Joi.forbidden() }),
  cnpj: Joi.string().length(14).pattern(/^\d+$/).when('role', { is: 'BUSINESS', then: Joi.required(), otherwise: Joi.forbidden() }),
});

async function registerUser(req, res, next) {
  try {
    const { error, value } = userSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return fail(res, error.details.map(e => e.message), 400);
    }

    const { name, email, password, role, cpf, cnpj } = value;

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
      return fail(res, 'E-mail, CPF ou CNPJ já cadastrado', 409);
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

    return success(res, user, 'Usuário criado com sucesso');
  } catch (err) {
    next(err);
  }
}

const filters = {};
if (req.query.role) filters.role = req.query.role;
const users = await prisma.user.findMany({
  where: filters,
  select: { id: true, name: true, email: true, role: true, cpf: true, cnpj: true },
});

// ...demais funções (listUsers, loginUser, getMe) permanecem como estão...

module.exports = {
  registerUser,
  listUsers,
  loginUser,
  getMe,
};