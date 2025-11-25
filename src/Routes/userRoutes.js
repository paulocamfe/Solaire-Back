const express = require('express');
const router = express.Router();
const { 
    registerResidentialUser, 
    registerBusinessUser, 
    loginUser, 
    listUsers, 
    getMe,
    getResidentialSummary,
    // Importando as novas funções
    forgotPassword,
    resetPassword
} = require('../controllers/userController');
const autenticar = require('../middleware/auth');

// =================== Rotas públicas ===================

// Endpoint para registar um utilizador residencial
router.post('/register/residential', registerResidentialUser);

// Endpoint para registar uma nova empresa (utilizador empresarial)
router.post('/register/business', registerBusinessUser);

// Endpoint de login
router.post('/login', loginUser);

// --- NOVAS ROTAS PÚBLICAS PARA RECUPERAÇÃO DE SENHA ---
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// =================== Rotas privadas (exigem autenticação) ===================

// Busca os dados do utilizador autenticado
router.get('/me', autenticar, getMe);

// Busca o resumo (dashboard) do utilizador residencial autenticado
router.get('/me/summary', autenticar, getResidentialSummary);

// Lista todos os utilizadores (geralmente para administradores)
router.get('/', autenticar, listUsers);

module.exports = router;