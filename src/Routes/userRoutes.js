const express = require('express');
const router = express.Router();
const { registerUser, loginUser, listUsers, getMe } = require('../controllers/userController');

// ===================== ROTAS PÚBLICAS =====================
router.post('/', registerUser);      // POST /users
router.post('/login', loginUser);    // POST /users/login

// ===================== ROTAS SEM AUTENTICAÇÃO =====================
router.get('/', listUsers);          // GET /users
router.get('/me', getMe);            // GET /users/me (pega o primeiro usuário para teste)

module.exports = router;
