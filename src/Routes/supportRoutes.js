const express = require('express');
const router = express.Router();
const { createSupport, getSupport, deleteSupport } = require('../controllers/supportController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /support:
 *   post:
 *     summary: Criar novo ticket de suporte
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               assunto:
 *                 type: string
 *               mensagem:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket criado com sucesso
 */
router.post('/', createSupport);

/**
 * @swagger
 * /support:
 *   get:
 *     summary: Listar tickets de suporte
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tickets
 */
router.get('/', auth, getSupport);

/**
 * @swagger
 * /support/{id}:
 *   delete:
 *     summary: Deletar ticket de suporte
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ticket deletado com sucesso
 */
router.delete('/:id', auth, deleteSupport);

module.exports = router;