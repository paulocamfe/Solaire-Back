const { sendMail } = require('../helpers/mailer'); // responsável por enviar e-mail

async function subscribe(req, res, next) {
  try {
    console.log('📩 Requisição recebida em /newsletter/subscribe');
    console.log('Corpo da requisição:', req.body);

    const email = req.body.email && String(req.body.email).trim().toLowerCase();
    console.log('E-mail processado:', email);

    if (!email || !/^[\w-.]+@[\w-]+\.[a-z]{2,}$/i.test(email)) {
      console.warn('⚠️ E-mail inválido recebido:', email);
      return fail(res, 'E-mail inválido', 400);
    }

    // 🔎 Verifica se já existe no banco
    console.log('🔍 Verificando se o e-mail já existe no banco...');
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (existing) {
      console.warn('⚠️ E-mail já cadastrado:', email);

      // Reenvia o e-mail de confirmação
      try {
        console.log('📨 Reenviando e-mail de confirmação para:', email);
        await sendMail({
          to: email,
          subject: 'Você já está na nossa Newsletter!',
          html: `
            <h2>Você já está inscrito 🎉</h2>
            <p>Fique tranquilo, continuaremos te enviando nossas novidades!</p>
          `,
        });
        console.log('✅ E-mail de confirmação reenviado com sucesso.');
      } catch (mailErr) {
        console.error('❌ Erro ao reenviar e-mail:', mailErr);
      }

      return success(res, null, 'E-mail já cadastrado. Enviamos novamente sua confirmação.');
    }

    // 🧱 Cria novo registro
    console.log('🧱 Criando novo registro no banco...');
    const novo = await prisma.newsletterSubscriber.create({ data: { email } });
    console.log('✅ Registro criado com sucesso:', novo);

    // ✉️ Envia o e-mail de boas-vindas
    try {
      console.log('📨 Enviando e-mail de boas-vindas para:', email);
      await sendMail({
        to: email,
        subject: 'Bem-vindo(a) à nossa Newsletter!',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="color: #0056b3;">Obrigado por se inscrever!</h1>
            <p>Olá,</p>
            <p>Você agora está na nossa lista para receber todas as novidades sobre energia solar, atualizações exclusivas do nosso app e as melhores dicas para maximizar sua energia.</p>
            <p>Fique de olho na sua caixa de entrada!</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe Solaire Energia</strong></p>
          </div>
        `,
      });
      console.log('✅ E-mail de boas-vindas enviado com sucesso!');
    } catch (mailErr) {
      console.error('❌ Erro ao enviar e-mail de boas-vindas:', mailErr);
    }

    return success(res, null, 'Inscrição realizada com sucesso! Verifique seu e-mail.');
  } catch (err) {
    console.error('🔥 ERRO GERAL NO CONTROLLER DE NEWSLETTER 🔥');
    console.error('Mensagem:', err.message);
    console.error('Stack:', err.stack);
    next(err);
  }
}

module.exports = { subscribe };
