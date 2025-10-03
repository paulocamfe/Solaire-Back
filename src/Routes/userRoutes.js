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

// Public routes
router.post('/', registerUser);                  // POST /users -> cadastro
router.post('/login', loginUser);               // POST /users/login -> login
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Rate limiter para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: 'Muitas tentativas, tente novamente mais tarde.'
});
router.post('/login', loginLimiter, loginUser);

// Protected routes
router.get('/', autenticar, listUsers);       // GET /users -> lista de usuários
router.get('/me', autenticar, getMe);         // GET /users/me -> dados do usuário logado
router.get('/empresas', autenticar, requireRole('BUSINESS'), (req, res) => {
  res.json({ success: true, message: 'Rota de empresas funcionando' });
});

module.exports = router;
