// Arquivo: controllers/measurementController.js

const { prisma } = require("../prismaClient");
const { success, fail } = require('../helpers/response');

// ==================== INGESTÃO DE MEDIÇÃO (SEM ALTERAÇÕES) ====================
// Esta função está perfeita e não precisa ser alterada.
async function ingestMeasurement(req, res, next) {
    try {
        const serial = req.body.serial && String(req.body.serial).trim();
        const { energia_kWh, status } = req.body; // Adicionei 'status' caso o painel envie

        if (!serial || typeof energia_kWh !== 'number') {
            return res.status(400).json({ error: 'Serial e energia_kWh são obrigatórios e válidos.' });
        }

        const panel = await prisma.panel.findUnique({
            where: { serial },
            select: { id: true },
        });

        if (!panel) {
            return res.status(401).json({ error: 'Painel não autorizado ou não provisionado.' });
        }

        const newMeasurement = await prisma.measurement.create({
            data: {
                panelId: panel.id,
                energia_kWh: energia_kWh,
                status: status || 'OK', // Usa o status enviado ou um padrão
                timestamp: new Date(),
            },
        });

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

// ==================== LISTAR MEDIÇÕES DE UM PAINEL (VERSÃO SEGURA) ====================
// Função implementada com verificação de posse e paginação.
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
        
        const totalMeasurements = await prisma.measurement.count({ where: { panelId: panelId }});

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
};