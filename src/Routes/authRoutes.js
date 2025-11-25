const express = require('express');
const {
  registerUser,
  loginUser,
  verify2FACode,
  resend2FACode,
} = require('../controllers/authController');

const router = express.Router();

// Registro
router.post('/register', registerUser);

// Login (envia código 2FA)
router.post('/login', loginUser);

// Verificar código 2FA
router.post('/verify-2fa', verify2FACode);

// Reenviar código
router.post('/resend-code', resend2FACode);

module.exports = router;