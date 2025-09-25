const express = require("express");
const router = express.Router();

const {
  ingestMeasurement,
  ping,
  listMeasurementsByPanel,
  getMeasurement,
  getSummary,
} = require("../controllers/measurementController");

const autenticar = require("../middleware/auth");

// POST /measurements → cria uma nova medição
router.post("/", autenticar, ingestMeasurement);

// POST /measurements/ping → teste de autenticação
router.post("/ping", autenticar, ping);

// GET /measurements/panel/:panelId → lista todas as medições de um painel
router.get("/panel/:panelId", autenticar, listMeasurementsByPanel);

// GET /measurements/:id → retorna uma medição específica
router.get("/:id", autenticar, getMeasurement);

// GET /measurements/panel/:panelId/summary?days=7 → resumo do painel
router.get("/panel/:panelId/summary", autenticar, getSummary);

module.exports = router;
