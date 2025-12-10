const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(email) {
  try {
    await resend.emails.send({
      from: "noreply@seusite.com",   // troque isso pelo seu domínio verificado
      to: email,
      subject: "Bem-vindo(a) à nossa Newsletter!",
      html: `
        <h1>🎉 Obrigado por se inscrever!</h1>
        <p>Agora você receberá novidades e conteúdos exclusivos.</p>
      `,
    });

    console.log("📨 Email enviado para:", email);
  } catch (error) {
    console.error("❌ Erro ao enviar email:", error);
  }
}

module.exports = {
  sendWelcomeEmail,
};
