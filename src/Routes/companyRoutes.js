const express = require('express');
const router = express.Router();

const {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
} = require('../controllers/companyController');

const autenticar = require('../middleware/auth');
const { checkRole } = require('../middleware/roles'); 

// =================== ROTAS DE COMPANY ===================

// GET /companies -> Lista todas as empresas (Apenas para ADMINS)
router.get('/', autenticar, checkRole(['ADMIN']), getAllCompanies);

// POST /companies -> Cria uma nova empresa (Apenas para ADMINS)
router.post('/', autenticar, checkRole(['ADMIN']), createCompany);

// GET /companies/:id -> Busca uma empresa específica pelo ID
// Um usuário BUSINESS só pode ver sua própria empresa, um ADMIN pode ver qualquer uma.
router.get('/:id', autenticar, getCompanyById);

// PUT /companies/:id -> Atualiza uma empresa (Apenas para ADMINS)
router.put('/:id', autenticar, checkRole(['ADMIN']), updateCompany);

// DELETE /companies/:id -> Deleta uma empresa (Apenas para ADMINS)
router.delete('/:id', autenticar, checkRole(['ADMIN']), deleteCompany);

module.exports = router;