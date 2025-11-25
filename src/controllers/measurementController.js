const { prisma } = require("../prismaClient");
const { success, fail } = require('../helpers/response');

async function ingestMeasurement(req, res, next) {
    try {
        const serial = req.body.serial && String(req.body.serial).trim();
        const { potencia_W, temperatura, tensao, corrente, status } = req.body;
        if (!serial || typeof potencia_W !== 'number') {
            return res.status(400).json({ error: 'Serial e potencia_W (numérico) são obrigatórios.' });
        }
        const panel = await prisma.panel.findUnique({
            where: { serial },
            select: { id: true },
        });
        if (!panel) {
            return res.status(401).json({ error: 'Painel não autorizado ou não provisionado.' });
        }
        const intervaloSegundos = 5.0; 
        const energia_kWh = (potencia_W / 1000.0) * (intervaloSegundos / 3600.0);
        const newMeasurement = await prisma.measurement.create({
            data: {
                panelId: panel.id,
                energia_kWh: energia_kWh, 
                status: status || 'OK',
                timestamp: new Date(),

                // --- SALVANDO OS NOVOS DADOS ---
                potencia_W: potencia_W,
                temperatura: temperatura,
                tensao: tensao,
                corrente: corrente
            },
        });

        // (O resto da função continua igual: update no lastSeen e resposta 202)
        // ...
        await prisma.panel.update({
             where: { id: panel.id },
             data: { lastSeen: new Date() },
        });

        return res.status(202).json({
             message: 'Medição registrada com sucesso.',
             id: newMeasurement.id,
        });

    } catch (err) {
        next(err);
    }
}

async function ping(req, res) {
    return res.status(200).json({ message: "pong" });
}

// ==================== LISTAR MEDIÇÕES DE UM PAINEL (VERSÃO SEGURA) ====================

async function getMeasurement(req, res, next) {
    try {
        const measurementId = parseInt(req.params.id, 10);
        const userId = req.user.id; 

        const measurement = await prisma.measurement.findUnique({
            where: { id: measurementId },
            include: {
                panel: true 
            },
        });

        if (!measurement) {
            return fail(res, 'Medição não encontrada', 404);
        }
        if (measurement.panel.userId !== userId) {
            return fail(res, 'Você não tem permissão para ver esta medição.', 403);
        }

        return success(res, measurement);

    } catch (err) {
        next(err);
    }
}

async function getSummary(req, res, next) {
    try {
        const panelId = parseInt(req.params.panelId, 10);
        const userId = req.user.id;
        const days = parseInt(req.query.days, 10) || 7;
        const panel = await prisma.panel.findUnique({ where: { id: panelId } });
        if (!panel) return fail(res, 'Painel não encontrado', 404);
        if (panel.userId !== userId) return fail(res, 'Acesso não autorizado', 403);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await prisma.measurement.aggregate({
            _sum: {
                energia_kWh: true,
            },
            where: {
                panelId: panelId,
                timestamp: {
                    gte: startDate, 
                },
            },
        });

        const totalEnergy = result._sum.energia_kWh || 0;

        return success(res, {
            panelId: panelId,
            periodo_dias: days,
            total_gerado_kWh: totalEnergy,
            media_diaria_kWh: totalEnergy / days,
        });

    } catch (err) {
        next(err);
    }
}

async function listMeasurementsByPanel(req, res, next) {
    try {
        const userId = req.user.id; // Do middleware de autenticação
        const panelId = parseInt(req.params.panelId, 10);

        // Paginação
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;

        const user = await prisma.user.findUnique({ where: { id: userId } });

        // 1. Busca o painel para verificar a quem ele pertence
        const panel = await prisma.panel.findUnique({
            where: { id: panelId },
            include: { branch: true }
        });

        if (!panel) return fail(res, 'Painel não encontrado', 404);

        // 2. Verifica se o usuário logado é o dono do painel
        let isOwner = false;
        if (user.role === 'RESIDENTIAL' && panel.userId === userId) {
            isOwner = true;
        }
        if (user.role === 'BUSINESS' && panel.branch?.companyId === user.companyId) {
            isOwner = true;
        }

        if (!isOwner) {
            return fail(res, 'Você não tem permissão para ver as medições deste painel.', 403);
        }

        // 3. Se for o dono, busca as medições com paginação
        const measurements = await prisma.measurement.findMany({
            where: { panelId: panelId },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: skip,
        });

        const totalMeasurements = await prisma.measurement.count({ where: { panelId: panelId } });

        return success(res, {
            pagination: {
                total: totalMeasurements,
                page,
                pages: Math.ceil(totalMeasurements / limit),
            },
            data: measurements
        });

    } catch (err) {
        next(err);
    }
}


module.exports = {
    ingestMeasurement,
    listMeasurementsByPanel,
    ping,
    getMeasurement,
    getSummary,
};