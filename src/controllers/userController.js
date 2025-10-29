const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Funções auxiliares para respostas padronizadas
const success = (res, data, message = 'Success') => {
  return res.json({ success: true, data, message });
};

const fail = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error });
};

// ==================== REGISTRO RESIDENCIAL ====================
async function registerResidentialUser(req, res, next) {
  try {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password || !cpf) {
      return fail(res, 'Nome, email, senha e CPF são obrigatórios.');
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { cpf }] },
    });
    if (existingUser) {
      return fail(res, 'E-mail ou CPF já cadastrado.');
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        cpf,
        role: 'RESIDENTIAL',
      },
    });

    return success(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }, 'Usuário residencial registrado com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== REGISTRO EMPRESARIAL ====================
async function registerBusinessUser(req, res, next) {
  try {
    const { userName, userEmail, password, companyName, companyCnpj } = req.body;

    if (!userName || !userEmail || !password || !companyName || !companyCnpj) {
      return fail(res, 'Todos os campos são obrigatórios para o cadastro empresarial');
    }

    const existingCompany = await prisma.company.findUnique({ where: { cnpj: companyCnpj } });
    if (existingCompany) return fail(res, 'CNPJ já cadastrado');

    const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (existingUser) return fail(res, 'E-mail já cadastrado');

    const hashed = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: { name: companyName, cnpj: companyCnpj },
      });

      const newUser = await tx.user.create({
        data: {
          name: userName,
          email: userEmail,
          password: hashed,
          role: 'BUSINESS',
          companyId: newCompany.id,
        },
      });

      await tx.branch.create({
        data: {
          name: 'Sede Principal',
          address: 'Endereço não informado',
          companyId: newCompany.id
        }
      });

      return { user: newUser, company: newCompany };
    });

    return success(res, {
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      company: { id: result.company.id, name: result.company.name }
    }, 'Empresa e usuário administrador registrados com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== LOGIN ====================
async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Preencha todos os campos');

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

// ==================== BUSCAR DADOS DO USUÁRIO LOGADO====================
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, companyId: true },
    });

    if (!user) return fail(res, 'Usuário não encontrado', 404);

    return success(res, user, 'Usuário autenticado com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== RESUMO DE DADOS DO USUÁRIO RESIDENCIAL ====================
async function getResidentialSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days, 10) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.role !== 'RESIDENTIAL') {
        return fail(res, 'Esta rota é apenas para usuários residenciais.', 403);
    }

    const energyData = await prisma.measurement.aggregate({
        _sum: { energia_kWh: true },
        where: {
            panel: { userId: userId },
            timestamp: { gte: fromDate },
        },
    });

    const totalEnergiaKWh = energyData._sum.energia_kWh || 0;
    // Garanta que os valores padrão existam no modelo de usuário ou defina-os aqui
    const tarifaKwh = user.tarifaKwh || 0.5; // Exemplo de valor padrão
    const fatorCo2Kwh = user.fatorCo2Kwh || 0.82; // Exemplo de valor padrão

    const dinheiroEconomizado = totalEnergiaKWh * tarifaKwh;
    const co2EvitadoKg = totalEnergiaKWh * fatorCo2Kwh;

    return success(res, {
        userId,
        periodoDias: days,
        totalEnergiaKWh: parseFloat(totalEnergiaKWh.toFixed(2)),
        dinheiroEconomizado: parseFloat(dinheiroEconomizado.toFixed(2)),
        co2EvitadoKg: parseFloat(co2EvitadoKg.toFixed(2)),
    });
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

// ==================== SOLICITAR REDEFINIÇÃO DE SENHA ====================
const crypto = require('crypto');

async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, 'O campo email é obrigatório.');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Não revelar se o email existe
      return success(res, null, 'Se houver uma conta com o email informado, um link foi enviado.');
    }

    // Gera um token aleatório e um hash seguro para armazenar
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Define validade de 1 hora
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Salva no banco (invalida tokens antigos)
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Simula envio de email com link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    console.log(`(Simulação) Enviar e-mail para ${email}: ${resetLink}`);

    return success(res, null, 'Se houver uma conta com o email informado, um link foi enviado.');
  } catch (err) {
    next(err);
  }
}


// ==================== RESETAR A SENHA ====================
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return fail(res, 'O token e a nova senha são obrigatórios.');
    }

    // Gera hash do token recebido (para comparar)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Busca o registro correspondente e ainda válido
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      return fail(res, 'Token inválido ou expirado.', 401);
    }

    // Criptografa e atualiza senha
    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashed },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);

    return success(res, null, 'Senha redefinida com sucesso.');
  } catch (err) {
    next(err);
  }
}


// ==================== EXPORTAÇÕES ====================
module.exports = {
  registerResidentialUser,
  registerBusinessUser,
  loginUser,
  getMe,
  getResidentialSummary,
  listUsers,
  requestPasswordReset, // Função adicionada
  resetPassword,        // Função adicionada
};