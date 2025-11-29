const prisma = require('../prismaClient');
const { success, fail } = require('../helpers/response');

// ==================== ADICIONAR UM PAINEL ====================
async function addPanel(req, res, next) {
    try {
        const userId = req.user.id;
        const { serial, location, model } = req.body;

        if (!serial) return fail(res, 'Serial da placa é obrigatório.', 400);
        if (!location) return fail(res, 'Localização é obrigatória.', 400);

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) return fail(res, 'Usuário não encontrado.', 404);

        // Checar se o painel já existe para este usuário
        const existingPanel = await prisma.panel.findFirst({
            where: { serial, userId }
        });

        if (existingPanel) {
            return fail(res, 'Já existe um painel com este serial no seu sistema.', 409);
        }

        // Limite de painéis para residencial
        if (user.role === 'RESIDENTIAL') {
            const panelCount = await prisma.panel.count({ where: { userId } });
            if (panelCount >= 10) {
                return fail(res, 'Limite de 10 painéis por usuário residencial atingido.', 403);
            }
        }
        console.log("BODY RECEBIDO:", req.body);
        console.log("USER LOGADO:", req.user);

        const newPanel = await prisma.panel.create({
            data: {
                serial,
                location,
                model: model || 'Genérico',
                status: 'Ativa',
                user: { connect: { id: userId } },
            }
        });

        return success(res, { panel: newPanel }, 'Painel adicionado com sucesso.');
    } catch (err) {
        console.error('❌ Erro no addPanel:', err);
        return fail(res, 'Erro interno do servidor ao adicionar painel.', 500);
    }
}

// ==================== LISTAR PAINÉIS DO USUÁRIO ====================
async function listMyPanels(req, res, next) {
    try {
        const userId = req.user.id;
        const panels = await prisma.panel.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        return success(res, panels, 'Lista de painéis carregada com sucesso.');
    } catch (err) {
        console.error('❌ Erro no listMyPanels:', err);
        next(err);
    }
}

// ==================== DETALHES DE UM PAINEL ====================
async function getPanelDetails(req, res, next) {
    try {
        const userId = req.user.id;
        const panelId = parseInt(req.params.id, 10);

        const panel = await prisma.panel.findUnique({ where: { id: panelId } });

        if (!panel) return fail(res, 'Painel não encontrado', 404);
        if (panel.userId !== userId) return fail(res, 'Você não tem permissão para ver este painel.', 403);

        return success(res, panel, 'Detalhes do painel carregados com sucesso.');
    } catch (err) {
        console.error('❌ Erro no getPanelDetails:', err);
        next(err);
    }
}

// ==================== ATUALIZAR UM PAINEL ====================
async function updatePanel(req, res, next) {
    try {
        const userId = req.user.id;
        const panelId = parseInt(req.params.id, 10);
        const { location, status } = req.body;

        const panel = await prisma.panel.findUnique({ where: { id: panelId } });
        if (!panel) return fail(res, 'Painel não encontrado.', 404);
        if (panel.userId !== userId) return fail(res, 'Você não tem permissão para atualizar este painel.', 403);

        const updatedPanel = await prisma.panel.update({
            where: { id: panelId },
            data: { ...(location && { location }), ...(status && { status }) }
        });

        return success(res, { panel: updatedPanel }, 'Painel atualizado com sucesso.');
    } catch (err) {
        console.error('❌ Erro no updatePanel:', err);
        next(err);
    }
}

// ==================== DELETAR UM PAINEL ====================
async function deletePanel(req, res, next) {
    try {
        const userId = req.user.id;
        const panelId = parseInt(req.params.id, 10);

        const panel = await prisma.panel.findUnique({ where: { id: panelId } });
        if (!panel) return fail(res, 'Painel não encontrado.', 404);
        if (panel.userId !== userId) return fail(res, 'Você não tem permissão para deletar este painel.', 403);

        await prisma.panel.delete({ where: { id: panelId } });

        return success(res, null, 'Painel deletado com sucesso.');
    } catch (err) {
        console.error('❌ Erro no deletePanel:', err);
        next(err);
    }
}

module.exports = {
    addPanel,
    listMyPanels,
    getPanelDetails,
    updatePanel,
    deletePanel
};
