const prisma = require('../prismaClient');

/**
 * POST /panels/provision
 * Body: { serial, location?, model? }
 * Cria ou atualiza um painel (provisionamento) e vincula ao usuário logado.
 */
async function provisionPanel(req, res, next) {
  try {
    const serial = req.body.serial && String(req.body.serial).trim();
    const location = req.body.location ? String(req.body.location).trim() : '';
    const model = req.body.model ? String(req.body.model).trim() : '';

    if (!serial) return res.status(400).json({ error: 'serial é obrigatório' });

    const panel = await prisma.panel.upsert({
      where: { serial },
      update: { location, model, userId: req.user.id }, // vincula ao usuário logado
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
 */
async function listPanels(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [panels, total] = await Promise.all([
      prisma.panel.findMany({
        where: { userId: req.user.id }, // só os painéis do usuário logado
        select: {
          id: true,
          serial: true,
          location: true,
          model: true,
          installedAt: true,
          lastSeen: true,
          userId: true,
        },
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      prisma.panel.count({
        where: { userId: req.user.id },
      }),
    ]);

    return res.json({
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
      data: panels,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /panels/:id
 * Obter detalhes de um painel específico do usuário logado.
 */
async function getPanel(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const panel = await prisma.panel.findFirst({
      where: { id, userId: req.user.id }, // garante que pertence ao usuário
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

    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });
    return res.json(panel);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /panels/link
 * Body: { panelId }
 * Vincula uma panel existente ao usuário logado.
 */
async function linkPanelToUser(req, res, next) {
  try {
    const panelId = req.body.panelId && Number(req.body.panelId);
    if (!panelId) return res.status(400).json({ error: 'panelId é obrigatório' });

    const panel = await prisma.panel.findUnique({ where: { id: panelId } });
    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });

    const updated = await prisma.panel.update({
      where: { id: panelId },
      data: { userId: req.user.id },
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

    return res.json({ message: 'Panel vinculado ao usuário', panel: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  provisionPanel,
  listPanels,
  getPanel,
  linkPanelToUser,
};
