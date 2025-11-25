const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Módulo nativo do Node para criptografia
const { sendMail } = require('../helpers/mailer'); // Helper para enviar e-mail

const prisma = new PrismaClient();

// Suas funções de resposta (já existentes no seu ficheiro)
const success = (res, data, message = 'Success') => {
  return res.json({ success: true, data, message });
};

const fail = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error });
};

// ==================== SUAS FUNÇÕES EXISTENTES ====================
// ... (registerResidentialUser, registerBusinessUser, loginUser, getMe, etc. permanecem aqui) ...
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
    const dinheiroEconomizado = totalEnergiaKWh * user.tarifaKwh;
    const co2EvitadoKg = totalEnergiaKWh * user.fatorCo2Kwh;

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


// ==================== NOVAS FUNÇÕES ====================

async function forgotPassword(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email },
    });

    if (!user) {
      // Por segurança, não revele se o e-mail existe ou não
      return success(res, null, 'Se um utilizador com esse e-mail existir, um link de redefinição foi enviado.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validade

    await prisma.user.update({
      where: { email: user.email },
      data: {
        resetToken: hashedToken, // Usando o nome correto do seu schema
        resetTokenExpires,
      },
    });

    // Construa a URL para o seu frontend, passando o token (NÃO o hashed token)
    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Crie o conteúdo do e-mail
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Recuperação de Senha</h2>
        <p>Recebemos um pedido para redefinir a sua senha. Clique no link abaixo para continuar.</p>
        <p>Este link é válido por 15 minutos.</p>
        <a href="${resetURL}" style="background-color: #f5b025; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
        <p>Se não foi você que solicitou, por favor, ignore este e-mail.</p>
      </div>
    `;

    await sendMail({
      to: user.email,
      subject: 'Redefinição da sua Senha Solaire',
      html: emailHtml,
    });
    
    return success(res, null, 'Se um utilizador com esse e-mail existir, um link de redefinição foi enviado.');

  } catch (err) {
    next(err);
  }
}


async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    // 1. Recrie o hash do token recebido para procurar na base de dados
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Procure o utilizador pelo token e verifique se não expirou
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpires: { gte: new Date() }, // gte = "maior ou igual a", ou seja, a data ainda é válida
      },
    });

    // 3. Se não encontrar, o token é inválido ou expirou
    if (!user) {
      return fail(res, 'Token inválido ou expirado.', 400);
    }
    
    // 4. Valide a nova senha
    if (!password || password.length < 6) {
      return fail(res, 'A senha deve ter pelo menos 6 caracteres.', 400);
    }

    // 5. Crie o hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Atualize a senha e limpe os campos de redefinição
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return success(res, null, 'Senha redefinida com sucesso!');

  } catch (err) {
    next(err);
  }
}


module.exports = {
  registerResidentialUser,
  registerBusinessUser,
  loginUser,
  getMe,
  getResidentialSummary,
  listUsers,
  // Exportando as novas funções
  forgotPassword,
  resetPassword,
};