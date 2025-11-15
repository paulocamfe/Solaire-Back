// src/controllers/authController.js

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { sendMail } = require('../helpers/mailer.js');

/**
 * Registra um novo usuário e envia e-mail de confirmação
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, cpf } = req.body;

    // Verifica se já existe usuário com o mesmo e-mail
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'E-mail já cadastrado.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        cpf,
        twoFactorCode: verificationToken,
        twoFactorExpires: new Date(Date.now() + 24*60*60*1000), 
        twoFactorEnabled: false,
      },
    });

    // Deep link para o app Expo
    const deepLink = `solaireapp://confirmacao-email?token=${verificationToken}`;

    // Envia e-mail com botão
    await sendMail({
      to: email,
      subject: 'Confirme seu E-mail - Ativação de Conta',
      html: `
        <h2>Bem-vindo(a), ${name}!</h2>
        <p>Clique no botão abaixo para confirmar seu e-mail e ativar sua conta:</p>
        <a href="${deepLink}" 
           style="background-color: #FFD700; color: black; padding: 10px 20px; text-decoration: none; border-radius: 12px;">
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
 * Verifica a conta do usuário a partir do token recebido no deep link
 */
const verifyAccount = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token de verificação ausente.');

    const user = await prisma.user.findFirst({ where: { twoFactorCode: token } });
    if (!user) return res.status(404).send('Link de verificação inválido ou já utilizado.');

    if (user.twoFactorExpires && new Date() > user.twoFactorExpires)
      return res.status(400).send('Link de verificação expirado.');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorCode: null,
        twoFactorExpires: null,
      },
    });

    // Retorna JSON com deep link (app Expo vai interpretar)
    const deepLink = `solaireapp://confirmacao-email?token=${token}`;
    res.json({ message: 'Conta verificada!', deepLink });

  } catch (error) {
    console.error('Erro na verificação de conta:', error);
    res.status(500).send('Ocorreu um erro ao processar sua solicitação.');
  }
};

/**
 * Login opcional via token (para deep link ou integração externa)
 */
const loginWithToken = async (req, res) => {
  const { token } = req.body;
  try {

    res.json({ message: 'Login feito com sucesso!' });
  } catch (e) {
    res.status(400).json({ message: 'Token inválido.' });
  }
};

module.exports = {
  registerUser,
  verifyAccount,
  loginWithToken,
};
