const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const prisma = new PrismaClient();

// ==================== CONFIGURAÇÃO DE EMAIL ====================
let transporter;
try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || undefined,
            host: process.env.EMAIL_HOST || undefined,
            port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
            secure: process.env.EMAIL_SECURE === "true",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
} catch (err) {
    console.error(" Erro ao configurar transporte de email:", err);
    transporter = null;
}

async function sendEmail(to, subject, html) {
    if (!transporter) {
        console.log(` (Simulado) Email para ${to}: ${subject}`);
        return;
    }
    try {
        await transporter.sendMail({
            from: `"Solaire ☀️" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(` Email enviado para ${to}`);
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
        console.error(" Erro no registro residencial:", err);
        return fail(res, "Erro interno no servidor.", 500);
    }
}

// ==================== REGISTRO EMPRESARIAL ====================
async function registerBusinessUser(req, res) {
    try {
        const { userName, userEmail, password, companyName, companyCnpj } = req.body;

        if (!userName || !userEmail || !password || !companyName || !companyCnpj) {
            return fail(res, "Todos os campos são obrigatórios para o cadastro empresarial");
        }

        const existingCompany = await prisma.company.findUnique({ where: { cnpj: companyCnpj } });
        if (existingCompany) return fail(res, "CNPJ já cadastrado");

        const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
        if (existingUser) return fail(res, "E-mail já cadastrado");

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
            `<h2>Olá, ${result.user.name}!</h2>
            <p>Seu cadastro empresarial na <b>Solaire</b> foi concluído com sucesso.</p>
            <p>Empresa: <b>${result.company.name}</b></p>
            <p>Agora você pode gerenciar suas filiais e acompanhar a geração de energia da sua empresa.</p>
            <br/><p>Equipe Solaire ☀️</p>`
        );

        return success(
            res,
            {
                user: { id: result.user.id, name: result.user.name, email: result.user.email },
                company: { id: result.company.id, name: result.company.name },
            },
            "Empresa e usuário administrador registrados com sucesso"
        );
    } catch (err) {
        console.error("Erro no registro empresarial:", err);
        return fail(res, "Erro interno no servidor.", 500);
    }
}

// ==================== LOGIN ====================
async function loginUser(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) return fail(res, "Preencha todos os campos");

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return fail(res, "Usuário não encontrado", 404);

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return fail(res, "Senha inválida", 401);

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "segredo",
            { expiresIn: "7d" }
        );

        return success(
            res,
            { id: user.id, name: user.name, email: user.email, role: user.role, token },
            "Login realizado com sucesso"
        );
    } catch (err) {
        console.error(" Erro no login:", err);
        return fail(res, "Erro interno no servidor.", 500);
    }
}

// ==================== DADOS DO USUÁRIO ====================
async function getMe(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, role: true, companyId: true },
        });

        if (!user) return fail(res, "Usuário não encontrado", 404);
        return success(res, user, "Usuário autenticado com sucesso");
    } catch (err) {
        console.error(" Erro ao buscar usuário:", err);
        return fail(res, "Erro interno no servidor.", 500);
    }
}

// ==================== RESUMO RESIDENCIAL ====================
async function getResidentialSummary(req, res) {
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
        console.error(" Erro no resumo residencial:", err);
        return fail(res, "Erro interno no servidor.", 500);
    }
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
    registerResidentialUser,
    registerBusinessUser,
    loginUser,
    getMe,
    getResidentialSummary,
};
