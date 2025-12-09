const express = require('express');
const router = express.Router();
const {
  registerResidentialUser,
  registerBusinessUser,
  loginUser,
  listUsers,
  getMe,
  getResidentialSummary,
  forgotPassword,
  resetPassword,
  deleteUser
} = require('../controllers/userController');
const autenticar = require('../middleware/auth');
const upload = require("../helpers/uploadConfig");
const { updateProfileImage } = require("../controllers/userController");

// =================== Rotas públicas ===================

// Registrar usuário residencial
router.post('/register/residential', registerResidentialUser);

// Registrar usuário empresarial
router.post('/register/business', registerBusinessUser);

// Login
router.post('/login', loginUser);

// Recuperação de senha
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// =================== Rotas privadas (exigem autenticação) ===================

// Dados do usuário autenticado
router.get('/me', autenticar, getMe);

// Resumo do usuário residencial autenticado
router.get('/me/summary', autenticar, getResidentialSummary);

// Listar todos os usuários (admin)
router.get('/', autenticar, listUsers);

// Deletar usuário
router.delete('/:id', autenticar, deleteUser);

router.put(
  "/users/me/profile-image",
  authMiddleware,              
  upload.single("profileImage"), 
  updateProfileImage
);


module.exports = router;