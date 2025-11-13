// src/Routes/authRoutes.js
const express = require('express');
const { registerUser, verifyAccount, loginWithToken } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerUser);
router.get('/verify-account', verifyAccount);
router.post('/login-with-token', loginWithToken);

module.exports = router;
