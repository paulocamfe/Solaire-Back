const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(to) {
  try {
    console.log("📨 Enviando email via Resend para:", to);

    const response = await resend.emails.send({
      from: "Solaire <onboarding@resend.dev>",
      to,
      subject: "Bem-vindo à nossa Newsletter!",
      html: `
        <h2>☀️ Bem-vindo à Solaire!</h2>
        <p>Obrigado por se inscrever na nossa newsletter. Em breve você receberá novidades sobre energia sustentável e atualizações exclusivas!</p>
        <p>— Equipe Solaire</p>
      `,
    });

    console.log("📧 Email enviado com sucesso:", response);
    return { success: true };
  } catch (error) {
    console.error("❌ Erro ao enviar email Resend:", error);
    return { success: false, error };
  }
}

module.exports = {
  sendWelcomeEmail,
};
