const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const sendNewsletterEmail = require("../helpers/mailer"); // seu mailer

// Rota da newsletter
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    // Verifica se o e-mail já está cadastrado
    const existing = await prisma.newsletter.findUnique({
      where: { email },
    });

    // ─────────────────────────────────────────────
    // ENVIA O EMAIL SEMPRE (NOVO OU REPETIDO)
    // ─────────────────────────────────────────────
    await sendNewsletterEmail(email);

    // Se já estiver cadastrado, só envia email e retorna sucesso
    if (existing) {
      return res.status(200).json({
        message: "E-mail enviado com sucesso (já estava cadastrado).",
      });
    }

    // Se não existir, cria
    await prisma.newsletter.create({
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
