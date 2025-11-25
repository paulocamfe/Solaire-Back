const nodemailer = require('nodemailer');

const transportOptions = process.env.EMAIL_HOST
  ? {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    }
  : {
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

const transporter = nodemailer.createTransport(transportOptions);

transporter.verify((err) => {
  if (err) console.error('❌ Mailer verify error:', err);
  else console.log('✅ Mailer ready');
});

const sendMail = async (options) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Solaire" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('📨 Email enviado:', info.response || info);
    return info;
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    throw error;
  }
};

module.exports = { sendMail };