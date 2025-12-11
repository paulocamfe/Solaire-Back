const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.elasticemail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.ELASTIC_EMAIL_USER,
    pass: process.env.ELASTIC_EMAIL_KEY,
  },
});

async function sendNewsletterEmail(to) {
  try {
    const info = await transporter.sendMail({
      from: `Solaire <${process.env.ELASTIC_EMAIL_USER}>`,
      to,
      subject: "Bem-vindo à Newsletter da Solaire!",
      html: `
        <h2>☀️ Bem-vindo à Solaire!</h2>
        <p>Obrigado por se inscrever na nossa newsletter.</p>
        <p>Você receberá novidades e informações exclusivas!</p>
        <br />
        <p>— Equipe Solaire</p>
      `,
    });

    console.log("📧 Email enviado:", info.messageId);
    return { success: true };

  } catch (err) {
    console.error("❌ Erro ao enviar email:", err);
    return { success: false, error: err };
  }
}

module.exports = sendNewsletterEmail;

