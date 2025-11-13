// authController.js

// Eu preciso importar o bcrypt para criptografar a senha
const bcrypt = require('bcrypt');
// Eu preciso do crypto para gerar um token de verificação seguro
const crypto = require('crypto');
// Eu vou usar o prismaClient que eu já configurei, e não criar um novo
const { prisma } = require('./prismaClient.js');
// Eu vou usar o meu helper 'mailer.js' para enviar e-mails
const { sendMail } = require('./helpers/mailer.js');

// Pego a URL base da minha API e do meu Front-end do .env
// Isso é essencial para montar o link de verificação
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3333';
const FRONTEND_LOGIN_URL = process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login';

// =============== CRIAR CONTA (registerUser) ===============
const registerUser = async (req, res) => {
  try {
    // Pego os dados que o usuário enviou no corpo da requisição
    const { name, email, password, cpf } = req.body;

    // Verifico se esse e-mail já existe no banco
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'E-mail já cadastrado.' });
    }

    // Criptografo a senha antes de salvar no banco, por segurança
    const hashedPassword = await bcrypt.hash(password, 10);

    // Gero um token de verificação longo e seguro
    // Isso é muito melhor que um código de 6 dígitos
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Crio o novo usuário no banco
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        cpf,
        twoFactorCode: verificationToken, // Salvo o token no campo do 2FA
        twoFactorExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // Token expira em 24 horas
        twoFactorEnabled: false, // A conta começa como NÂO verificada
      },
    });

    // Monto o link completo que o usuário vai clicar
    const verificationLink = `${API_BASE_URL}/auth/verify-account?token=${verificationToken}`;

    // Envio o e-mail usando meu helper
    await sendMail({
      to: email,
      subject: 'Confirme seu E-mail - Ativação de Conta',
      // O HTML do e-mail agora tem um botão com o link
      html: `
        <h2>Bem-vindo(a), ${name}!</h2>
        <p>Obrigado por se cadastrar. Por favor, clique no botão abaixo para confirmar seu e-mail e ativar sua conta:</p>
        <div style="margin-top: 20px;">
            <a href="${verificationLink}" 
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">
               Confirmar E-mail
            </a>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">Se o botão não funcionar, copie e cole este link: <br> ${verificationLink}</p>
        <p>Este link é válido por 24 horas.</p>
      `,
    });

    // Respondo ao front-end que deu tudo certo
    res.status(201).json({ message: 'Usuário criado! Verifique seu e-mail para ativar a conta.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar usuário.' });
  }
};

// =============== VERIFICAR CONTA VIA LINK (verifyAccount) ===============
const verifyAccount = async (req, res) => {
  try {
    // Pego o token que veio na URL (ex: ...?token=meutoken123)
    const { token } = req.query;

    if (!token) {
      // Se não veio token, é um erro
      return res.status(400).send('<h1>Erro: Token de verificação ausente.</h1>');
    }

    // Busco o usuário que tem esse token salvo
    const user = await prisma.user.findFirst({
      where: { twoFactorCode: token },
    });

    // Se não achei o usuário, o link é inválido ou já foi usado
    if (!user) {
      return res.status(404).send('<h1>Erro: Link de verificação inválido ou já utilizado.</h1>');
    }

    // Verifico se o token já expirou
    if (user.twoFactorExpires && new Date() > user.twoFactorExpires) {
      return res.status(400).send('<h1>Erro: Link de verificação expirado.</h1> <p>Por favor, tente logar para receber um novo link.</p>');
    }

    // Se deu tudo certo:
    // 1. Ativo a conta do usuário (twoFactorEnabled = true)
    // 2. Limpo o token do banco (para não ser usado de novo)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorCode: null, // Limpo o token
        twoFactorExpires: null, // Limpo a expiração
      },
    });

    // Mando o usuário de volta para a tela de login do meu front-end
    // O .send() é só um fallback se o redirect falhar
    res.redirect(FRONTEND_LOGIN_URL);

  } catch (error) {
    console.error('Erro na verificação de conta:', error);
    // Retorno uma página de erro simples, já que isso é no navegador
    res.status(500).send('<h1>Erro 500: Ocorreu um erro ao processar sua solicitação.</h1>');
  }
};


// Eu preciso exportar as funções para as rotas poderem usá-las
module.exports = {
  registerUser,
  verifyAccount,
};