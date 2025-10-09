const prisma = require('../prismaClient');
const { success, fail } = require('../helpers/response');
const { sendMail } = require('../helpers/mailer'); // 1. Importe a função de enviar e-mail

async function subscribe(req, res, next) {
  try {
    const email = req.body.email && String(req.body.email).trim().toLowerCase();
    if (!email || !/^[\w-.]+@[\w-]+\.[a-z]{2,}$/i.test(email)) {
      return fail(res, 'E-mail inválido', 400);
    }

    // Tenta criar o registro no banco de dados
    await prisma.newsletterSubscriber.create({ data: { email } });

    // 2. Se salvou com sucesso, prepare e envie o e-mail de boas-vindas
    const emailSubject = 'Bem-  vindo(a) à nossa Newsletter!';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1 style="color: #0056b3;">Obrigado por se inscrever!</h1>
        <p>Olá,</p>
        <p>Você agora está na nossa lista para receber todas as novidades sobre energia solar, atualizações exclusivas do nosso app e as melhores dicas para maximizar sua energia.</p>
        <p>Fique de olho na sua caixa de entrada!</p>
        <br>
        <p>Atenciosamente,</p>
        <p><strong>Equipe Solaire Energia</strong></p>
      </div>
    `;

    await sendMail({
      to: email,
      subject: emailSubject,
      html: emailHtml,
    });
    // FIM do envio de e-mail

    return success(res, null, 'Inscrição realizada com sucesso! Verifique seu e-mail.');
  } catch (err) {
    if (err.code === 'P2002') { // P2002 é o código do Prisma para "unique constraint failed"
      return fail(res, 'Este e-mail já está inscrito em nossa newsletter.', 409);
    }
    // Para outros erros, passe para o próximo middleware de erro
    next(err);
  }
}

module.exports = { subscribe };