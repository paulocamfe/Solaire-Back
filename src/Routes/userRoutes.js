const express = require('express');
const router = express.Router();
const { registerUser, loginUser, listUsers, getMe } = require('../controllers/userController');
const autenticar = require('../middlewares/autenticar');

// Rotas públicas
router.post('/', registerUser);
router.post('/login', loginUser);

// Rotas privadas
router.get('/me', autenticar, getMe);
router.get('/', autenticar, listUsers);

module.exports = router;
