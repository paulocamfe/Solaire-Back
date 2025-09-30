const prisma = require('../prismaClient');

/**
 * POST /panels/provision
 * Body: { serial, location?, model? }
 * Cria ou atualiza um painel (provisionamento) e vincula ao usuário logado.
 */
async function provisionPanel(req, res, next) {
  try {
    const serial = req.body.serial?.trim();
    const location = req.body.location?.trim() || '';
    const model = req.body.model?.trim() || '';

    if (!serial) return res.status(400).json({ error: 'serial é obrigatório' });

    const panel = await prisma.panel.upsert({
      where: { serial },
      update: { location, model, userId: req.user.id },
      create: { serial, location, model, userId: req.user.id },
      select: {
        id: true,
        serial: true,
        location: true,
        model: true,
        installedAt: true,
        lastSeen: true,
        userId: true,
      },
    });

    return res.status(201).json({ message: 'Panel provisioned', panel });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /panels?page=1&limit=50
 * Lista painéis do usuário logado com paginação.
 * Inclui status mais recente e última energia medida.
 */
async function listPanels(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const panels = await prisma.panel.findMany({
      where: { userId: req.user.id },
      skip,
      take: limit,
      orderBy: { id: 'asc' },
      include: {
        measurements: {
          orderBy: { timestamp: 'desc' },
          take: 1, // pega apenas a última medição
        },
      },
    });

    // Ajusta retorno para incluir status e energia mais recente
    const panelsWithStatus = panels.map((p) => ({
      id: p.id,
      serial: p.serial,
      location: p.location,
      model: p.model,
      installedAt: p.installedAt,
      lastSeen: p.lastSeen,
      userId: p.userId,
      energia_kWh: p.measurements[0]?.energia_kWh || 0,
      status: p.measurements[0]?.status || 'Desconhecido',
    }));

    const total = await prisma.panel.count({ where: { userId: req.user.id } });

    return res.json({
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
      data: panelsWithStatus,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /panels/:id
 * Obter detalhes de um painel específico pelo ID (do usuário logado).
 */
async function getPanel(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const panel = await prisma.panel.findFirst({
      where: { id, userId: req.user.id },
      include: {
        measurements: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });

    const result = {
      id: panel.id,
      serial: panel.serial,
      location: panel.location,
      model: panel.model,
      installedAt: panel.installedAt,
      lastSeen: panel.lastSeen,
      userId: panel.userId,
      energia_kWh: panel.measurements[0]?.energia_kWh || 0,
      status: panel.measurements[0]?.status || 'Desconhecido',
    };

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /panels/link
 * Body: { panelId }
 * Vincula um painel existente ao usuário logado.
 */
async function linkPanelToUser(req, res, next) {
  try {
    const panelId = Number(req.body.panelId);
    if (!panelId) return res.status(400).json({ error: 'panelId é obrigatório' });

    const panel = await prisma.panel.findUnique({ where: { id: panelId } });
    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });

    const updated = await prisma.panel.update({
      where: { id: panelId },
      data: { userId: req.user.id },
    });

    return res.json({ message: 'Panel vinculado ao usuário', panel: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /panels/:serial/status
 * Body: { status, energia_kWh? }
 * Cria uma nova measurement para registrar alteração de status e energia do painel.
 */
async function updatePanelStatusBySerial(req, res, next) {
  try {
    const serial = String(req.params.serial).trim();
    const { status, energia_kWh } = req.body;

    if (!serial) return res.status(400).json({ error: 'serial é obrigatório' });
    if (!status) return res.status(400).json({ error: 'status é obrigatório' });

    const panel = await prisma.panel.findFirst({
      where: { serial, userId: req.user.id },
    });

    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });

    const measurement = await prisma.measurement.create({
      data: {
        panelId: panel.id,
        status,
        energia_kWh: energia_kWh || 0,
      },
    });

    return res.json({
      message: 'Status atualizado',
      panel: {
        id: panel.id,
        serial: panel.serial,
        location: panel.location,
        model: panel.model,
        installedAt: panel.installedAt,
        lastSeen: panel.lastSeen,
        userId: panel.userId,
        energia_kWh: measurement.energia_kWh,
        status: measurement.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  provisionPanel,
  listPanels,
  getPanel,
  linkPanelToUser,
  updatePanelStatusBySerial,
};
