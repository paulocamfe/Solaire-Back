const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.elasticemail.com",
  port: 2525,
  auth: {
    user: process.env.ELASTIC_EMAIL_USER,
    pass: process.env.ELASTIC_EMAIL_KEY,
  },
});

async function sendWelcomeEmail(to) {
  try {
    await transporter.sendMail({
      from: "Solaire <solairesenai@gmail.com>",
      to,
      subject: "Bem-vindo à Newsletter da Solaire!",
      html: `
        <h2>☀️ Bem-vindo à Solaire!</h2>
        <p>Obrigado por se inscrever na newsletter!</p>
        <p>— Equipe Solaire</p>
      `,
    });

    console.log("📧 Email enviado com sucesso!");
    return { success: true };

  } catch (err) {
    console.error("Erro ao enviar email:", err);
    return { success: false, error: err };
  }
}

module.exports = { sendWelcomeEmail };
