const prisma = require('../prismaClient');

/**
 * Helpers
 */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * POST /measurements
 * body: { panelId, voltage, current, power, temperature?, consumption?, status?, timestamp? }
 * Cria medição e atualiza panel.lastSeen
 */
async function ingestMeasurement(req, res, next) {
  try {
    const {
      panelId,
      voltage,
      current,
      power,
      temperature = null,
      consumption = 0,
      status = 'ok',
      timestamp,
    } = req.body;

    const pid = toNumber(panelId);
    const v = toNumber(voltage);
    const c = toNumber(current);
    const p = toNumber(power);
    const temp = temperature == null ? null : toNumber(temperature);
    const cons = toNumber(consumption);

    if (!Number.isFinite(pid) || !Number.isFinite(v) || !Number.isFinite(c) || !Number.isFinite(p)) {
      return res.status(400).json({ error: 'panelId, voltage, current e power são obrigatórios e numéricos' });
    }

    // verifica se a panel existe
    const panel = await prisma.panel.findUnique({ where: { id: pid } });
    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });

    const ts = timestamp ? new Date(timestamp) : new Date();

    const measurement = await prisma.measurement.create({
      data: {
        panelId: pid,
        timestamp: ts,
        voltage: v,
        current: c,
        power: p,
        temperature: Number.isFinite(temp) ? temp : null,
        consumption: Number.isFinite(cons) ? cons : 0,
        status: status == null ? 'ok' : String(status),
      },
    });

    // atualiza lastSeen da panel
    await prisma.panel.update({
      where: { id: pid },
      data: { lastSeen: ts },
    });

    return res.status(201).json({ message: 'Medição registrada', measurement });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /measurements/ping
 * body: { panelId, timestamp? }
 * Atualiza apenas lastSeen sem criar medição
 */
async function ping(req, res, next) {
  try {
    const { panelId, timestamp } = req.body;
    const pid = toNumber(panelId);
    if (!Number.isFinite(pid)) return res.status(400).json({ error: 'panelId é obrigatório e deve ser numérico' });

    const panel = await prisma.panel.findUnique({ where: { id: pid } });
    if (!panel) return res.status(404).json({ error: 'Panel não encontrado' });

    const ts = timestamp ? new Date(timestamp) : new Date();
    const updated = await prisma.panel.update({
      where: { id: pid },
      data: { lastSeen: ts },
      select: { id: true, lastSeen: true },
    });

    return res.json({ message: 'lastSeen atualizado', panel: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /panels/:panelId/measurements?page=&limit=&from=&to=
 * Lista medições de uma panel com paginação e filtros de tempo
 */
async function listMeasurementsByPanel(req, res, next) {
  try {
    const panelId = toNumber(req.params.panelId);
    if (!Number.isFinite(panelId)) return res.status(400).json({ error: 'panelId inválido' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const where = { panelId };
    if (req.query.from || req.query.to) {
      where.timestamp = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (!isNaN(from)) where.timestamp.gte = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        if (!isNaN(to)) where.timestamp.lte = to;
      }
    }

    const [data, total] = await Promise.all([
      prisma.measurement.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.measurement.count({ where }),
    ]);

    return res.json({
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /measurements/:id
 * Obter uma medição por id
 */
async function getMeasurement(req, res, next) {
  try {
    const id = toNumber(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    const measurement = await prisma.measurement.findUnique({ where: { id } });
    if (!measurement) return res.status(404).json({ error: 'Medição não encontrada' });

    return res.json(measurement);
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