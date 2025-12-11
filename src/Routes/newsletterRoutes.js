const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const { sendWelcomeEmail } = require("../helpers/mailer");


// Rota da newsletter
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    // Verifica se o e-mail já está cadastrado
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    // Envia o email SEMPRE
    await sendWelcomeEmail(email);


    // Se já existir
    if (existing) {
      return res.status(200).json({
        message: "E-mail enviado com sucesso (já estava cadastrado).",
      });
    }

    // Se NÃO existir, cria
    await prisma.newsletterSubscriber.create({
      data: { email },
    });

    return res.status(200).json({
      message: "Cadastrado com sucesso e e-mail enviado!",
    });

  } catch (error) {
    console.error("Erro na newsletter:", error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

module.exports = router;