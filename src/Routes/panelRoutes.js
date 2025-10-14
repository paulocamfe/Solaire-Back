// Arquivo: routes/panelRoutes.js

const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/auth');

// Importa os novos controllers, mais semânticos
const {
  addPanel,
  listMyPanels,
  getPanelDetails,
} = require('../controllers/panelController');

// Todas as rotas de painel exigem autenticação
router.use(autenticar);

// POST /panels → Adiciona um novo painel (para residencial ou business)
router.post('/', addPanel);

// GET /panels → Lista os painéis do contexto do usuário logado
router.get('/', listMyPanels);

// GET /panels/:id → Busca os detalhes de um painel específico (com verificação de posse)
router.get('/:id', getPanelDetails);

// Você pode adicionar outras rotas como PATCH ou DELETE aqui, seguindo o mesmo padrão.
// Ex: router.patch('/:id', updatePanel);

module.exports = router;