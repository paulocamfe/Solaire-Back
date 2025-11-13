// authRoutes.js

// Importo o Express para criar o roteador
const express = require('express');
// Importo meus controladores de autenticação
const { registerUser, verifyAccount } = require('../controllers/authController.js');

// Crio a instância do roteador
const router = express.Router();

// Rota para CRIAR um novo usuário
// Quando o front-end fizer POST em /auth/register, ele chama a função registerUser
router.post('/register', registerUser);

// Rota para VERIFICAR a conta
// Quando o usuário clicar no link do e-mail (GET em /auth/verify-account?token=...),
// ele chama a função verifyAccount
router.get('/verify-account', verifyAccount);

// Rota antiga de 2FA que eu não preciso mais
// router.post("/verify-2fa", verifyTwoFactorCode);

// Exporto o roteador para o App.js usar
module.exports = router;