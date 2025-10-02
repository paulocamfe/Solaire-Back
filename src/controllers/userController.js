const { sendMail } = require('../helpers/mailer');
const crypto = require('crypto');
// ...existing code...

// Solicitar reset de senha
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, 'E-mail não encontrado', 404);

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: expires },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Recuperação de senha',
      html: `<p>Para redefinir sua senha, clique <a href="${resetUrl}">aqui</a>.</p>`,
    });

    return success(res, null, 'E-mail de recuperação enviado');
  } catch (err) {
    next(err);
  }
}

// Resetar senha
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gte: new Date() },
      },
    });
    if (!user) return fail(res, 'Token inválido ou expirado', 400);

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpires: null },
    });

    return success(res, null, 'Senha redefinida com sucesso');
  } catch (err) {
    next(err);
  }
}

// ...demais funções (registerUser, listUsers, loginUser, getMe)...

module.exports = {
  registerUser,
  listUsers,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
};