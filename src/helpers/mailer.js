const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendWelcomeEmail(to) {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM, // ex: seuemail@gmail.com
      subject: "Bem-vindo à Newsletter Solaire!",
      html: `
        <h2>☀️ Bem-vindo à Solaire!</h2>
        <p>Obrigado por se inscrever na nossa newsletter.</p>
        <p>Em breve você receberá novidades exclusivas!</p>
        <br />
        <strong>Equipe Solaire</strong>
      `
    };

    await sgMail.send(msg);

    console.log("📨 Email enviado via SendGrid para:", to);
    return { success: true };

  } catch (error) {
    console.error("❌ Erro SendGrid:", error.response?.body || error);
    return { success: false, error };
  }
}

module.exports = {
  sendWelcomeEmail,
};
