const prisma = require('../prismaClient');

// POST /measurements
// Insere uma nova medição para um painel
async function ingestMeasurement(req, res, next) {
  try {
    const { panelId, voltage, current, power, temperature, consumption, status } = req.body;

    // Verifica se o painel pertence ao usuário logado
    const panel = await prisma.panel.findFirst({
      where: { id: Number(panelId), userId: req.user.id },
    });
    if (!panel) return res.status(403).json({ error: "Sem permissão para registrar nesse painel" });

    const measurement = await prisma.measurement.create({
      data: {
        panelId: panel.id,
        voltage,
        current,
        power,
        temperature,
        consumption,
        status,
      },
    });

    res.status(201).json(measurement);
  } catch (err) {
    next(err);
  }
}

// POST /measurements/ping
// Apenas confirma que a API está funcionando
async function ping(req, res, next) {
  try {
    res.json({ message: "pong", user: req.user });
  } catch (err) {
    next(err);
  }
}

// GET /measurements/panel/:panelId
// Lista todas as medições de um painel
async function listMeasurementsByPanel(req, res, next) {
  try {
    const { panelId } = req.params;

    // Confere se o painel é do usuário logado
    const panel = await prisma.panel.findFirst({
      where: { id: Number(panelId), userId: req.user.id },
    });
    if (!panel) return res.status(403).json({ error: "Sem permissão para acessar esse painel" });

    const measurements = await prisma.measurement.findMany({
      where: { panelId: panel.id },
      orderBy: { timestamp: 'desc' },
    });

    res.json(measurements);
  } catch (err) {
    next(err);
  }
}

// GET /measurements/:id
// Busca uma medição específica
async function getMeasurement(req, res, next) {
  try {
    const { id } = req.params;

    const measurement = await prisma.measurement.findUnique({
      where: { id: Number(id) },
      include: { panel: true },
    });

    if (!measurement) return res.status(404).json({ error: "Medição não encontrada" });

    // Garante que o painel pertence ao usuário logado
    if (measurement.panel.userId !== req.user.id) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    res.json(measurement);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ingestMeasurement,
  ping,
  listMeasurementsByPanel,
  getMeasurement,
};
