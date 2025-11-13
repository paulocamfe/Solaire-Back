// authController.js

const bcrypt = require('bcrypt');
const crypto = require('crypto');
// Usando o cliente Prisma centralizado
const { prisma } = require('../prismaClient');
const { sendMail } = require('../helpers/mailer.js');

// URLs base para montar os links de verificação e redirecionamento
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3333';
const FRONTEND_LOGIN_URL = process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login';

/**
 * Registra um novo usuário, envia e-mail de verificação.
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, cpf } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'E-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Gera um token hexadecimal seguro para verificação de e-mail
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        cpf,
        twoFactorCode: verificationToken, // Salva o token de verificação
        twoFactorExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expira em 24h
        twoFactorEnabled: false, // Conta começa como não verificada
      },
    });

    // Monta o link de verificação que será enviado por e-mail
    const verificationLink = `${API_BASE_URL}/auth/verify-account?token=${verificationToken}`;

    await sendMail({
      to: email,
      subject: 'Confirme seu E-mail - Ativação de Conta',
      html: `
        <h2>Bem-vindo(a), ${name}!</h2>
        <p>Clique no botão abaixo para confirmar seu e-mail e ativar sua conta:</p>
        <a href="${verificationLink}" 
           style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
           Confirmar E-mail
        </a>
        <p>Este link é válido por 24 horas.</p>
      `,
    });

    res.status(201).json({ message: 'Usuário criado! Verifique seu e-mail para ativar a conta.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar usuário.' });
  }
};

/**
 * Verifica a conta do usuário a partir do token recebido no link (GET).
 */
const verifyAccount = async (req, res) => {
  try {
    // Token é pego da query string da URL
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('Token de verificação ausente.');
    }

    // Busca o usuário pelo token de verificação
    const user = await prisma.user.findFirst({
      where: { twoFactorCode: token },
    });

    // Se o token não existe ou já foi usado, o usuário não é encontrado
    if (!user) {
      return res.status(404).send('Link de verificação inválido ou já utilizado.');
    }

    // Verifica se o token expirou
    if (user.twoFactorExpires && new Date() > user.twoFactorExpires) {
      return res.status(400).send('Link de verificação expirado.');
    }

    // Atualiza o usuário para ativar a conta e limpar o token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true, // Ativa a conta
        twoFactorCode: null, // Limpa o token para não ser reutilizado
        twoFactorExpires: null,
      },
    });

    // Redireciona o usuário para a página de login no front-end
    res.redirect(FRONTEND_LOGIN_URL);

  } catch (error) {
    console.error('Erro na verificação de conta:', error);
    res.status(500).send('Ocorreu um erro ao processar sua solicitação.');
  }
};

module.exports = {
  registerUser,
  verifyAccount,
};