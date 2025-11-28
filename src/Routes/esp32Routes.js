const express = require('express');
const router = express.Router();
const { receiveData } = require('../controllers/esp32Controller');

/**
 * @swagger
 * /esp32/data:
 *   post:
 *     summary: Receber dados do ESP32
 *     tags: [ESP32]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               panelId:
 *                 type: integer
 *               temperatura:
 *                 type: number
 *               corrente:
 *                 type: number
 *               tensao:
 *                 type: number
 *               potencia:
 *                 type: number
 *     responses:
 *       200:
 *         description: Dados recebidos com sucesso
 */
router.post('/data', receiveData);

module.exports = router;