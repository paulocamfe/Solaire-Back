const express = require('express');
const router = express.Router();

const { provisionPanel, listPanels, getPanel, linkPanelToUser } = require('../controllers/panelController');
const autenticar = require('../middleware/auth');

// Provision (geralmente protegido)
router.post('/', autenticar, provisionPanel);

// Listar panels (protegido)
router.get('/', autenticar, listPanels);

// Detalhes da panel (protegido)
router.get('/:id', autenticar, getPanel);

// Vincular panel a usuário (protegido)
router.post('/', autenticar, linkPanelToUser);

module.exports = router;