const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/auth');

const {
  provisionPanel,
  listPanels,
  getPanel,
  linkPanelToUser,
} = require('../controllers/panelController');

// POST /panels/provision → cria ou atualiza painel e vincula ao usuário
router.post('/provision', autenticar, provisionPanel);

// GET /panels → lista todos os painéis do usuário logado
router.get('/', autenticar, listPanels);

// GET /panels/:id → detalhes de um painel específico do usuário
router.get('/:id', autenticar, getPanel);

// POST /panels/link → vincula um painel existente ao usuário logado
router.post('/link', autenticar, linkPanelToUser);

module.exports = router;
