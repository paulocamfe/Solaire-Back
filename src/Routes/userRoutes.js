const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { 
  registerUser, 
  listUsers, 
  loginUser, 
  getMe, 
  forgotPassword, 
  resetPassword 
} = require('../controllers/userController');

const autenticar = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// ===================== ROTAS PÚBLICAS =====================
// Cadastro de usuário
router.post('/', registerUser); // POST /users

// Recuperação de senha
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Rate limiter para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { success: false, error: 'Muitas tentativas, tente novamente mais tarde.' }
});

// Login com rate limiter
router.post('/login', loginLimiter, loginUser); // POST /users/login

// ===================== ROTAS PROTEGIDAS =====================
// Lista todos os usuários (somente autenticado)
router.get('/', autenticar, listUsers);

// Dados do usuário logado
router.get('/me', autenticar, getMe);

// Exemplo de rota restrita por role (BUSINESS)
router.get('/empresas', autenticar, requireRole('BUSINESS'), (req, res) => {
  res.json({ success: true, message: 'Rota de empresas funcionando' });
});

module.exports = router;
