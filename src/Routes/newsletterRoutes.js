const express = require("express");
const prisma = require("../prismaClient.js");
const { sendWelcomeEmail } = require("../helpers/mailer.js");

const router = express.Router();

router.post("/subscribe", async (req, res) => {
  try {
    console.log("📥 Requisição recebida em /newsletter/subscribe");
    console.log("Corpo da requisição:", req.body);

    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "E-mail inválido" });
    }

    const normalized = email.trim().toLowerCase();

    console.log("🔍 Verificando se o e-mail já existe no banco...");
    const exists = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalized },
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        error: "Este e-mail já está inscrito!",
      });
    }

    console.log("📝 Criando novo registro no banco...");
    const created = await prisma.newsletterSubscriber.create({
      data: { email: normalized },
    });

    console.log("✔️ Registro criado:", created);

    console.log("📨 Enviando e-mail de boas-vindas...");
    await sendWelcomeEmail(normalized);

    return res.json({
      success: true,
      message: "Inscrição realizada com sucesso!",
    });
  } catch (error) {
    console.error("🔥 Erro inesperado:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
});

module.exports = router;
