const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const prisma = require("../prismaClient");

// ==================== CONFIGURAÇÃO DE EMAIL ====================
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || undefined,
  host: process.env.EMAIL_HOST || undefined,
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Solaire ☀️" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📨 Email enviado para ${to}`);
  } catch (err) {
    console.error("Erro ao enviar email:", err);
    throw err;
  }
}

// ==================== RESPOSTAS PADRÃO ====================
const success = (res, data, message = "Success") =>
  res.json({ success: true, data, message });

const fail = (res, error, statusCode = 400) =>
  res.status(statusCode).json({ success: false, error });

// ==================== DELETAR USUÁRIO ====================
const deleteUser = async (req, res) => {
  try {
    const { id, email, name, cpf } = req.body;

    if (!id && !email && !name && !cpf) {
      return res.status(400).json({
        message: "Informe id, email, nome ou cpf para deletar o usuário.",
      });
    }

    const filter = {};
    if (id) filter.id = id;
    if (email) filter.email = email;
    if (name) filter.name = name;
    if (cpf) filter.cpf = cpf;

    const user = await prisma.user.findFirst({ where: filter });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Apaga resets
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    // Painéis do usuário -> desvincula (ou apaga, se preferir)
    await prisma.panel.updateMany({
      where: { userId: user.id },
      data: { userId: null },
    });

    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: `Usuário ${user.name} deletado com sucesso!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao deletar usuário." });
  }
};

// ==================== REGISTRO RESIDENCIAL ====================
async function registerResidentialUser(req, res, next) {
  try {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password || !cpf) {
      return fail(res, "Nome, email, senha e CPF são obrigatórios.");
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { cpf }] },
    });
    if (existingUser) return fail(res, "E-mail ou CPF já cadastrado.");

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, cpf, role: "RESIDENTIAL" },
    });

    await sendEmail(
      user.email,
      "Bem-vindo à Solaire ☀️",
      `<h2>Olá, ${user.name}!</h2>
<p>Seu cadastro na <b>Solaire</b> foi realizado com sucesso.</p>
<p>Agora você pode acessar seu painel e acompanhar o desempenho de suas placas solares!</p>
<br/><p>Equipe Solaire ☀️</p>`
    );

    return success(
      res,
      { id: user.id, name: user.name, email: user.email, role: user.role },
      "Usuário residencial registrado com sucesso"
    );
  } catch (err) {
    next(err);
  }
}

// ==================== REGISTRO EMPRESARIAL ====================
async function registerBusinessUser(req, res, next) {
  try {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password) {
      return fail(res, "Nome, email e senha são obrigatórios para cadastro empresarial");
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { cpf }] },
    });
    if (existingUser) return fail(res, "E-mail ou CPF já cadastrado.");

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        cpf: cpf || null,
        role: "BUSINESS",
      },
    });

    await sendEmail(
      user.email,
      "Cadastro empresarial - Solaire ☀️",
      `<h2>Olá, ${user.name}!</h2>
<p>Seu cadastro empresarial na <b>Solaire</b> foi concluído com sucesso.</p>
<p>Agora você pode gerenciar suas placas solares e acompanhar a geração de energia.</p>
<br/><p>Equipe Solaire ☀️</p>`
    );

    return success(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      "Usuário empresarial registrado com sucesso"
    );
  } catch (err) {
    next(err);
  }
}

// ==================== LOGIN ====================
async function loginUser(req, res, next) {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET || JWT_SECRET === "segredo") {
      throw new Error("Erro interno: JWT_SECRET não está configurado.");
    }

    const { email, password } = req.body;
    if (!email || !password) return fail(res, "Preencha todos os campos");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, "Usuário não encontrado", 404);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return fail(res, "Senha inválida", 401);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return success(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
      "Login realizado com sucesso"
    );
  } catch (err) {
    next(err);
  }
}

// ==================== PERFIL DO USUÁRIO ====================
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return fail(res, "Usuário não encontrado", 404);
    return success(res, user, "Usuário autenticado com sucesso");
  } catch (err) {
    next(err);
  }
}

// ==================== SUMMARY ====================
function getTarifaECo2PorRole(role) {
  return role === "BUSINESS"
    ? { tarifaKwh: 0.95, fatorCo2Kwh: 0.101 } // empresarial
    : { tarifaKwh: 0.75, fatorCo2Kwh: 0.0718 }; // residencial
}

async function getSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days, 10) || 30;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return fail(res, "Usuário não encontrado", 404);

    const energyData = await prisma.measurement.aggregate({
      _sum: { energia_kWh: true },
      where: { panel: { userId }, timestamp: { gte: fromDate } },
    });

    const totalEnergiaKWh = energyData._sum.energia_kWh || 0;

    const { tarifaKwh, fatorCo2Kwh } = getTarifaECo2PorRole(user.role);

    return success(res, {
      userId,
      periodoDias: days,
      totalEnergiaKWh: parseFloat(totalEnergiaKWh.toFixed(2)),
      dinheiroEconomizado: parseFloat((totalEnergiaKWh * tarifaKwh).toFixed(2)),
      co2EvitadoKg: parseFloat((totalEnergiaKWh * fatorCo2Kwh).toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
}

async function getResidentialSummary(req, res, next) {
  if (req.user.role !== "RESIDENTIAL")
    return fail(res, "Apenas usuários residenciais", 403);
  return getSummary(req, res, next);
}

async function getBusinessSummary(req, res, next) {
  if (req.user.role !== "BUSINESS")
    return fail(res, "Apenas usuários empresariais", 403);
  return getSummary(req, res, next);
}

// ==================== LISTA DE USUÁRIOS ====================
async function listUsers(req, res, next) {
  try {
    if (req.user.role !== "ADMIN") {
      return fail(res, "Acesso negado", 403);
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
    });

    return success(res, users, "Lista de usuários");
  } catch (err) {
    next(err);
  }
}

// ==================== SOLICITAR RESET SENHA ====================
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, "Email obrigatório");

    const user = await prisma.user.findUnique({ where: { email } });

    // Mesmo se não encontrar, responde OK (segurança)
    if (!user)
      return success(res, null, "Se existir uma conta, um código foi enviado.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash("sha256").update(code).digest("hex");

    await prisma.passwordReset.deleteMany({
      where: { userId: user.id, used: false },
    });

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await sendEmail(
      email,
      "Código de redefinição - Solaire",
      `<h2>Seu código:</h2><h1>${code}</h1><p>Válido por 15 minutos</p>`
    );

    return success(
      res,
      null,
      "Se existir uma conta, um código foi enviado."
    );
  } catch (err) {
    next(err);
  }
}

// ==================== RESET SENHA ====================
async function resetPassword(req, res, next) {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword)
      return fail(res, "Preencha todos os campos");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, "Usuário não encontrado", 404);

    const hash = crypto.createHash("sha256").update(code).digest("hex");

    const record = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        tokenHash: hash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) return fail(res, "Código inválido ou expirado", 401);

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      }),
      prisma.passwordReset.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    return success(res, null, "Senha redefinida com sucesso");
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
  getBusinessSummary,
  listUsers,
  requestPasswordReset,
  resetPassword,
  deleteUser,
};
