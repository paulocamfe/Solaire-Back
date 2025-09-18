const express = require('express');
const router = express.Router();

const {
  ingestMeasurement,
  ping,
  listMeasurementsByPanel,
  getMeasurement,
} = require('../controllers/measurementController');

const autenticar = require('../middleware/auth'); // ou deviceAuth se dispositivos enviarem sem usuário

// Quando montado em app.use('/measurements', router):
// POST /measurements
router.post('/', autenticar, ingestMeasurement);

// POST /measurements/ping
router.post('/ping', autenticar, ping);

// GET /measurements/:id
router.get('/:id', autenticar, getMeasurement);

module.exports = router;