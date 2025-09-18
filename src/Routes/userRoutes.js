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

module.exports = router;