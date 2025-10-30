const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

const enviarEmail = async (para, assunto, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: para,
      subject: assunto,
      html,
    });
    console.log(`Email enviado para ${para}`);
  } catch (err) {
    console.log("Erro ao enviar email:", err);
    throw err;
  }
};

module.exports = enviarEmail;
