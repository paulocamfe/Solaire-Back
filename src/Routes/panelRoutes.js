// Arquivo: routes/panelRoutes.js

const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/auth');

// Importa todos os controllers
const {
  addPanel,
  listMyPanels,
  getPanelDetails,
  updatePanel,
  deletePanel
} = require('../controllers/panelController');

// Todas as rotas de painel exigem autenticação
router.use(autenticar);

// POST /panels → Adiciona um novo painel (para residencial ou business)
router.post('/', addPanel);

// GET /panels → Lista os painéis do contexto do usuário logado
router.get('/', listMyPanels);

// GET /panels/:id → Busca os detalhes de um painel específico (com verificação de posse)
router.get('/:id', getPanelDetails);

// PATCH /panels/:id → Atualiza um painel específico (com verificação de posse)
router.patch('/:id', updatePanel);

// DELETE /panels/:id → Deleta um painel específico (com verificação de posse)
router.delete('/:id', deletePanel);

module.exports = router;