    const express = require('express');
    const router = express.Router();
    const { 
        registerResidentialUser, 
        registerBusinessUser, 
        loginUser, 
        listUsers, 
        getMe,
        getResidentialSummary,
        requestPasswordReset,
        resetPassword
    } = require('../controllers/userController');
    const autenticar = require('../middleware/auth');

    // =================== Rotas públicas ===================

    // Endpoint para registrar um usuário residencial
    router.post('/register/residential', registerResidentialUser);

    // Endpoint para registrar uma nova empresa (usuário empresarial)
    router.post('/register/business', registerBusinessUser);

    // Endpoint de login
    router.post('/login', loginUser);

    // Endpoint para solicitar redefinição de senha (envia email com token)
    router.post('/forgot-password', requestPasswordReset);

    // Endpoint para resetar a senha (recebe email + token + nova senha)
    router.post('/reset-password', resetPassword);

    // =================== Rotas privadas (exigem autenticação) ===================

    // Busca os dados do usuário logado
    router.get('/me', autenticar, getMe);

    // Busca o resumo (dashboard) do usuário residencial logado
    router.get('/me/summary', autenticar, getResidentialSummary);

    // Lista todos os usuários (geralmente para administradores)
    router.get('/', autenticar, listUsers);

    module.exports = router;