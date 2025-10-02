const express = require('express');
const router = express.Router();

const { registerUser, listUsers, loginUser, getMe } = require('../controllers/userController');
const autenticar = require('../middleware/auth');

// Public routes
router.post('/', registerUser);     // POST /users      -> cadastro
router.post('/login', loginUser);   // POST /users/login -> login

// Protected routes
router.get('/', autenticar, listUsers); // GET /users -> lista de usuários (protegido)
router.get('/me', autenticar, getMe);   // GET /users/me -> dados do usuário logado

const requireRole = require('../middleware/requireRole');
router.get('/empresas', autenticar, requireRole('BUSINESS'), handler);

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Muitas tentativas, tente novamente mais tarde.' });
router.post('/login', loginLimiter, loginUser);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;