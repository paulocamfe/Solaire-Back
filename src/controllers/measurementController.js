const prisma = require("../prismaClient");

// POST /measurements → cria uma nova medição
async function ingestMeasurement(req, res, next) {
  try {
    const { panelId, energia_kWh, status } = req.body;

    // Verifica se o painel pertence ao usuário logado
    const panel = await prisma.panel.findFirst({
      where: { id: Number(panelId), userId: req.user.id },
    });
    if (!panel)
      return res
        .status(403)
        .json({ error: "Sem permissão para registrar nesse painel" });

    const measurement = await prisma.measurement.create({
      data: {
        panelId: panel.id,
        energia_kWh,
        status,
      },
    });

    res.status(201).json(measurement);
  } catch (err) {
    next(err);
  }
}

// POST /measurements/ping → teste rápido
async function ping(req, res, next) {
  try {
    res.json({ message: "pong", user: req.user });
  } catch (err) {
    next(err);
  }
}

// GET /measurements/panel/:panelId → lista todas as medições
async function listMeasurementsByPanel(req, res, next) {
  try {
    const { panelId } = req.params;

    const panel = await prisma.panel.findFirst({
      where: { id: Number(panelId), userId: req.user.id },
    });
    if (!panel)
      return res
        .status(403)
        .json({ error: "Sem permissão para acessar esse painel" });

    const measurements = await prisma.measurement.findMany({
      where: { panelId: panel.id },
      orderBy: { timestamp: "desc" },
    });

    res.json(measurements);
  } catch (err) {
    next(err);
  }
}

// GET /measurements/:id → retorna medição específica
async function getMeasurement(req, res, next) {
  try {
    const { id } = req.params;

    const measurement = await prisma.measurement.findUnique({
      where: { id: Number(id) },
      include: { panel: true },
    });

    if (!measurement)
      return res.status(404).json({ error: "Medição não encontrada" });

    if (measurement.panel.userId !== req.user.id) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    res.json(measurement);
  } catch (err) {
    next(err);
  }
}

// GET /measurements/panel/:panelId/summary?days=7 → resumo do período
async function getSummary(req, res, next) {
  try {
    const { panelId } = req.params;
    const days = parseInt(req.query.days || "7");

    const panel = await prisma.panel.findFirst({
      where: { id: Number(panelId), userId: req.user.id },
    });
    if (!panel) return res.status(403).json({ error: "Sem permissão" });

    const since = new Date();
    since.setDate(since.getDate() - days);

    const measurements = await prisma.measurement.findMany({
      where: {
        panelId: panel.id,
        timestamp: { gte: since },
      },
    });

    const total = measurements.reduce((acc, m) => acc + m.energia_kWh, 0);

    res.json({ panelId: panel.id, days, total, measurements });
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
