const express = require('express');
const router = express.Router();

const {
    createBranch,
    listBranchesByCompany,
    getBranchById,
    updateBranch,
    deleteBranch
} = require('../Controllers/branchController');

const autenticar = require('../middleware/auth');
const { checkRole } = require('../middleware/roles');

router.post('/', autenticar, checkRole(['ADMIN', 'BUSINESS']), createBranch);

router.get('/company/:companyId', autenticar, checkRole(['ADMIN', 'BUSINESS']), listBranchesByCompany);

router.get('/:id', autenticar, getBranchById);

router.put('/:id', autenticar, checkRole(['ADMIN', 'BUSINESS']), updateBranch);
router.delete('/:id', autenticar, checkRole(['ADMIN', 'BUSINESS']), deleteBranch);

module.exports = router;