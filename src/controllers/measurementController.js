const prisma = require("../prismaClient");

async function ingestMeasurement(req, res, next) {
  // lógica de ingestão
}

async function ping(req, res) {
  res.json({ ok: true });
}

async function listMeasurementsByPanel(req, res, next) {
  // lógica de listar medições
}

async function getMeasurement(req, res, next) {
  // lógica de buscar uma medição específica
}

async function getSummary(req, res, next) {
  try {
    const panelId = Number(req.params.panelId);
    const days = Number(req.query.days) || 1;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const totalResult = await prisma.measurement.aggregate({
      _sum: { energia_kWh: true },
      where: {
        panelId,
        timestamp: { gte: fromDate },
      },
    });

    res.json({ total: totalResult._sum.energia_kWh || 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ingestMeasurement,
  ping,
  listMeasurementsByPanel,
  getMeasurement,
  getSummary,
};
