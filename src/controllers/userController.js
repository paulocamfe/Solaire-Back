const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendMail } = require('../helpers/mailer');

const success = (res, data, message = 'Success') => {
  return res.json({ success: true, data, message });
};

const fail = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error });
};

// ==================== REGISTRO DE USUÁRIO RESIDENCIAL ====================
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

// ==================== REGISTRO DE USUÁRIO EMPRESARIAL ====================
async function registerBusinessUser(req, res, next) {
  try {
    const { userName, userEmail, password, companyName, cnpj } = req.body;

    if (!userName || !userEmail || !password || !companyName || !cnpj) {
      return fail(res, 'Todos os campos são obrigatórios para o cadastro empresarial');
    }

    const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (existingUser) return fail(res, 'E-mail já cadastrado');

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: userName,
        email: userEmail,
        password: hashed,
        role: 'BUSINESS',
        companyName,
        cnpj // <-- adicionando o CNPJ aqui
      },
    });

    return success(res, {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        companyName: newUser.companyName,
        cnpj: newUser.cnpj
      },
    }, 'Usuário empresarial registrado com sucesso');
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

    return success(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token
    }, 'Login realizado com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== BUSCAR DADOS DO USUÁRIO LOGADO ====================
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

// ==================== SOLICITAR RECUPERAÇÃO DE SENHA ====================
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return fail(res, 'Email é obrigatório.');
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Por segurança, não revele se o e-mail existe ou não
      return success(res, null, 'Se um utilizador com esse e-mail existir, um link de redefinição foi enviado.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await prisma.user.update({
      where: { email: user.email },
      data: {
        resetToken: hashedToken,
        resetTokenExpires,
      },
    });

    // Construa a URL para o seu frontend
    const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Recuperação de Senha</h2>
        <p>Recebemos um pedido para redefinir a sua senha. Clique no link abaixo para continuar.</p>
        <p>Este link é válido por 15 minutos.</p>
        <a href="${resetURL}" style="background-color: #f5b025; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Redefinir Senha</a>
        <p>Se não foi você que solicitou, por favor, ignore este e-mail.</p>
      </div>
    `;

    try {
      await sendMail({
        to: user.email,
        subject: 'Redefinição da sua Senha Solaire ☀️',
        html: emailHtml,
      });
    } catch (mailErr) {
      console.error('Erro ao enviar email:', mailErr);
      // Continua mesmo se o email falhar (em dev é normal)
    }

    return success(res, null, 'Se um utilizador com esse e-mail existir, um link de redefinição foi enviado.');
  } catch (err) {
    next(err);
  }
}

// ==================== REDEFINIR SENHA ====================
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return fail(res, 'Token e nova senha são obrigatórios.');
    }

    // Recrie o hash do token recebido
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Procure o utilizador pelo token e verifique se não expirou
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpires: { gte: new Date() },
      },
    });

    if (!user) {
      return fail(res, 'Token inválido ou expirado.', 400);
    }

    // Valide a nova senha
    if (password.length < 6) {
      return fail(res, 'A senha deve ter pelo menos 6 caracteres.', 400);
    }

    // Crie o hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualize a senha e limpe os campos de redefinição
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

// ==================== DELETAR USUÁRIO ====================
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return fail(res, 'ID do usuário é obrigatório.');
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    });

    if (!user) {
      return fail(res, 'Usuário não encontrado.', 404);
    }

    await prisma.user.delete({
      where: { id: parseInt(id) },
    });

    return success(res, null, 'Usuário deletado com sucesso.');
  } catch (err) {
    next(err);
  }
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  registerResidentialUser,
  registerBusinessUser,
  loginUser,
  getMe,
  getResidentialSummary,
  listUsers,
  forgotPassword,
  resetPassword,
  deleteUser,
};