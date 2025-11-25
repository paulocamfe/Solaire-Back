const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { sendMail } = require('../helpers/mailer.js');
const jwt = require('jsonwebtoken');

/**
 * Gera um código de 6 dígitos aleatório
 */
function generate2FACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Registra um novo usuário
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password || !cpf) {
      return res.status(400).json({ message: 'Nome, email, senha e CPF são obrigatórios.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'E-mail já cadastrado.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        cpf,
        twoFactorEnabled: false,
      },
    });

    // Envia e-mail de boas-vindas (verifique .env e transporter)
await sendMail({
  to: email,
  subject: 'Bem-vindo à Solaire ☀️',
  html: `
    <h2>Olá, ${name}!</h2>
    <p>Seu cadastro na <b>Solaire</b> foi concluído com sucesso.</p>
    <p>Antes de acessar sua conta, você precisa concluir a <b>verificação de dois fatores (2FA)</b>.</p>
    <p>Enviamos um código de verificação para o seu e-mail. Insira esse código na plataforma para ativar sua proteção extra.</p>
    <br/>
    <p>Após confirmar o 2FA, você terá acesso completo ao seu painel.</p>
    <br/>
    <p>Equipe Solaire ☀️</p>
  `,
});

    res.status(201).json({ 
      message: 'Usuário criado com sucesso!',
      userId: user.id,
      email: user.email 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar usuário.' });
  }
};

/**
 * Login - Gera código 2FA e envia por email
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    }

    // Gera código 2FA
    const code2FA = generate2FACode();
    const expiresIn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: code2FA,
        twoFactorExpires: expiresIn,
      },
    });

    // Envia código por email
    try {
      await sendMail({
        to: email,
        subject: 'Seu código de autenticação - Solaire ☀️',
        html: `
          <h2>Código de Autenticação</h2>
          <p>Seu código de 2FA é:</p>
          <h1 style="color: #FFD700; font-size: 32px; letter-spacing: 5px;">${code2FA}</h1>
          <p>Este código expira em <b>10 minutos</b>.</p>
          <p style="color: red; font-weight: bold;">⚠️ Não compartilhe este código com ninguém!</p>
        `,
      });
    } catch (mailErr) {
      console.error('Mailer error (não bloqueou login):', mailErr);
      // opcional: em ambiente de desenvolvimento, envie o código na resposta para testar:
      // return res.status(200).json({ message: 'Código gerado, falha ao enviar email.', userId: user.id, debugCode: code2FA });
    }
    
    res.status(200).json({ 
      message: 'Código 2FA enviado para seu email.',
      userId: user.id,
      email: email
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao fazer login.' });
  }
};

/**
 * Verifica o código 2FA e retorna JWT
 */
const verify2FACode = async (req, res) => {
  try {
    const { userId, email, cpf, cnpj, code } = req.body;

    if (!code || (!userId && !email && !cpf && !cnpj)) {
      return res.status(400).json({ message: 'Forneça code e um identificador (userId, email, cpf ou cnpj).' });
    }

    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (cpf) {
      user = await prisma.user.findUnique({ where: { cpf } });
    } else if (cnpj) {
      const company = await prisma.company.findUnique({ where: { cnpj } });
      if (!company) return res.status(404).json({ message: 'Empresa não encontrada para o CNPJ informado.' });

      const userCount = await prisma.user.count({ where: { companyId: company.id } });
      if (userCount === 0) return res.status(404).json({ message: 'Nenhum usuário associado a esse CNPJ.' });
      if (userCount > 1) return res.status(400).json({ message: 'Múltiplos usuários na empresa. Use email ou cpf para identificar o usuário.' });

      user = await prisma.user.findFirst({ where: { companyId: company.id } });
    }

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    if (!user.twoFactorExpires || new Date() > user.twoFactorExpires) {
      return res.status(400).json({ message: 'Código expirado. Faça login novamente.' });
    }

    if (user.twoFactorCode !== code.toString()) {
      return res.status(401).json({ message: 'Código incorreto.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: null,
        twoFactorExpires: null,
        twoFactorEnabled: true,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Autenticação bem-sucedida!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao verificar código.' });
  }
};

/**
 * Reenviar código 2FA (aceita id, email, cpf, cnpj)
 */
const resend2FACode = async (req, res) => {
  try {
    const { userId, email, cpf, cnpj } = req.body;

    if (!userId && !email && !cpf && !cnpj) {
      return res.status(400).json({ message: 'Forneça um identificador (userId, email, cpf ou cnpj).' });
    }

    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (cpf) {
      user = await prisma.user.findUnique({ where: { cpf } });
    } else if (cnpj) {
      const company = await prisma.company.findUnique({ where: { cnpj } });
      if (!company) return res.status(404).json({ message: 'Empresa não encontrada para o CNPJ informado.' });

      const userCount = await prisma.user.count({ where: { companyId: company.id } });
      if (userCount === 0) return res.status(404).json({ message: 'Nenhum usuário associado a esse CNPJ.' });
      if (userCount > 1) return res.status(400).json({ message: 'Múltiplos usuários na empresa. Use email ou cpf para identificar o usuário.' });

      user = await prisma.user.findFirst({ where: { companyId: company.id } });
    }

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const code2FA = generate2FACode();
    const expiresIn = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: code2FA,
        twoFactorExpires: expiresIn,
      },
    });

    await sendMail({
      to: email,
      subject: 'Seu código de autenticação - Solaire ☀️',
      html: `
        <h2>Código de Autenticação</h2>
        <p>Seu código de 2FA é:</p>
        <h1 style="color: #FFD700; font-size: 32px; letter-spacing: 5px;">${code2FA}</h1>
        <p>Este código expira em <b>10 minutos</b>.</p>
      `,
    });

    res.status(200).json({ 
      message: 'Novo código enviado para seu email.',
      userId: user.id,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao reenviar código.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verify2FACode,
  resend2FACode,
};