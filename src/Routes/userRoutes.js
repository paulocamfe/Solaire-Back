const express = require('express');
const router = express.Router();
const { registerUser, loginUser, listUsers, getMe } = require('../controllers');
const autenticar = require('../middleware/auth');

// Rotas públicas
router.post('/', registerUser);
router.post('/login', loginUser);

// Rotas privadas
router.get('/me', autenticar, getMe);
router.get('/', autenticar, listUsers);

module.exports = router;
