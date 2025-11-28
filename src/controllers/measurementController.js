const { prisma } = require("../prismaClient");
const { success, fail } = require('../helpers/response');

const tarifa = 0.64;
const fatorCO2 = 0.084; 

const energia_kWh = (potencia_W / 1000) * (intervaloSegundos / 3600);

const economia_R$ = energia_kWh * tarifa;
const co2_kg = energia_kWh * fatorCO2;

const newMeasurement = await prisma.measurement.create({
    data: {
        panelId: panel.id,
        energia_kWh,
        economia_R$,
        co2_kg,
        potencia_W,
        temperatura,
        tensao,
        corrente,
        status: status || 'OK',
        timestamp: new Date(),
    },
});


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

        // Busca o painel para verificar a quem ele pertence
        const panel = await prisma.panel.findUnique({
            where: { id: panelId },
        });

        if (!panel) return fail(res, 'Painel não encontrado', 404);

        // Verifica se o usuário logado é o dono do painel
        if (panel.userId !== userId) {
            return fail(res, 'Você não tem permissão para ver as medições deste painel.', 403);
        }

        // Busca as medições com paginação
        const measurements = await prisma.measurement.findMany({
            where: { panelId },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip,
        });

        const totalMeasurements = await prisma.measurement.count({ where: { panelId } });

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