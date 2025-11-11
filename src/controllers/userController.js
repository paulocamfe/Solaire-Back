const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const prisma = new PrismaClient();

// ==================== CONFIGURAÇÃO DE EMAIL ====================
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
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
    const info = await transporter.sendMail({
      from: `"Solaire ☀️" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📨 Email enviado para ${to} | ID: ${info.messageId}`);
  } catch (err) {
    console.error("❌ Erro ao enviar email:", err.message);
  }
}

// ==================== RESPOSTAS PADRÃO ====================
const success = (res, data, message = "Success") =>
  res.json({ success: true, data, message });

const fail = (res, error, statusCode = 400) =>
  res.status(statusCode).json({ success: false, error });

// ==================== REGISTRO RESIDENCIAL ====================
async function registerResidentialUser(req, res, next) {
  try {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password || !cpf)
      return fail(res, "Nome, email, senha e CPF são obrigatórios.");

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
      `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Olá, ${user.name}!</h2>
        <p>Seu cadastro na <b>Solaire</b> foi realizado com sucesso.</p>
        <p>Agora você pode acessar seu painel e acompanhar o desempenho das suas placas solares!</p>
        <p>Equipe Solaire ☀️</p>
      </div>
      `
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
    const { userName, userEmail, password, companyName, companyCnpj } = req.body;

    if (!userName || !userEmail || !password || !companyName || !companyCnpj)
      return fail(res, "Todos os campos são obrigatórios para o cadastro empresarial.");

    const existingCompany = await prisma.company.findUnique({
      where: { cnpj: companyCnpj },
    });
    if (existingCompany) return fail(res, "CNPJ já cadastrado.");

    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
    });
    if (existingUser) return fail(res, "E-mail já cadastrado.");

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
          role: "BUSINESS",
          companyId: newCompany.id,
        },
      });

      await tx.branch.create({
        data: {
          name: "Sede Principal",
          address: "Endereço não informado",
          companyId: newCompany.id,
        },
      });

      return { user: newUser, company: newCompany };
    });

    await sendEmail(
      result.user.email,
      "Cadastro empresarial - Solaire ☀️",
      `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Olá, ${result.user.name}!</h2>
        <p>Seu cadastro empresarial na <b>Solaire</b> foi concluído com sucesso.</p>
        <p>Empresa: <b>${result.company.name}</b></p>
        <p>Agora você pode gerenciar suas filiais e acompanhar a geração de energia da sua empresa.</p>
        <p>Equipe Solaire ☀️</p>
      </div>
      `
    );

    return success(
      res,
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        company: { id: result.company.id, name: result.company.name },
      },
      "Empresa e usuário administrador registrados com sucesso"
    );
  } catch (err) {
    next(err);
  }
}

// ==================== LOGIN ====================
async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, "Preencha todos os campos.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, "Usuário não encontrado.", 404);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return fail(res, "Senha inválida.", 401);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "segredo",
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
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) return fail(res, "Usuário não encontrado.", 404);
    return success(res, user, "Usuário autenticado com sucesso.");
  } catch (err) {
    next(err);
  }
}

// ==================== RESUMO RESIDENCIAL ====================
async function getResidentialSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days, 10) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.role !== "RESIDENTIAL")
      return fail(res, "Esta rota é apenas para usuários residenciais.", 403);

    const energyData = await prisma.measurement.aggregate({
      _sum: { energia_kWh: true },
      where: { panel: { userId }, timestamp: { gte: fromDate } },
    });

    const totalEnergiaKWh = energyData._sum.energia_kWh || 0;
    const tarifaKwh = user.tarifaKwh || 0.5;
    const fatorCo2Kwh = user.fatorCo2Kwh || 0.82;

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
    return success(res, users, "Lista de usuários.");
  } catch (err) {
    next(err);
  }
}

// ==================== SOLICITAR REDEFINIÇÃO DE SENHA ====================
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    console.log(email)
    if (!email) return fail(res, "O campo email é obrigatório.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return success(res, null, "Se houver uma conta com o email informado, um código foi enviado.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordReset.deleteMany({ where: { userId: user.id, used: false } });

    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: codeHash, expiresAt },
    });

    console.log("Código de redefinição gerado:", code);
    

    const emailHtml = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Redefinição de senha</h2>
        <p>Olá ${user.name},</p>
        <p>Use o código abaixo para redefinir sua senha:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>O código expira em 15 minutos.</p>
        <p>Equipe Solaire ☀️</p>
      </div>
    `;

    console.log(emailHtml)
    await sendEmail(user.email, "Código de redefinição de senha Solaire", emailHtml);
    return success(res, null, "Se houver uma conta com o email informado, um código foi enviado.");
  } catch (err) {
    next(err);
  }
}

 // ==================== RESETAR SENHA ====================
async function resetPassword(req, res, next) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return fail(res, "E-mail, código e nova senha são obrigatórios.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, "Usuário não encontrado.", 404);

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        tokenHash: codeHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) return fail(res, "Código inválido ou expirado.", 401);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualiza a senha e marca o código como usado
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);

    // Envia e-mail de confirmação
    const emailHtml = `
      <h2>Senha alterada com sucesso 🔒</h2>
      <p>Olá ${user.name},</p>
      <p>Sua senha da conta <b>Solaire</b> foi redefinida com sucesso.</p>
      <p>Se você não fez essa alteração, entre em contato imediatamente com o suporte.</p>
      <br/>
      <p>Equipe Solaire ☀️</p>
    `;

    await sendEmail(
      user.email,
      "Sua senha foi alterada com sucesso - Solaire ☀️",
      emailHtml
    );

    return success(res, null, "Senha redefinida com sucesso.");
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
  requestPasswordReset,
  resetPassword,
};
