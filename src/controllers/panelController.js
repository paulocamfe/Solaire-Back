// Arquivo: controllers/panelController.js

const { prisma } = require('../prismaClient');
// Supondo que você tenha helpers de resposta
const { success, fail } = require('../helpers/responseHandlers'); 

// ==================== ADICIONAR UM PAINEL (INTELIGENTE) ====================
// Esta função substitui 'provisionPanel' e 'linkPanelToUser'.
async function addPanel(req, res, next) {
    try {
        const userId = req.user.id; // Vem do middleware 'autenticar'
        // Para BUSINESS, esperamos também o ID da filial
        const { serial, location, model, branchId } = req.body;

        if (!serial || !location || !model) {
            return fail(res, 'Serial, location e model são obrigatórios.');
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });

        // --- LÓGICA PARA USUÁRIO RESIDENCIAL ---
        if (user.role === 'RESIDENTIAL') {
            const panelCount = await prisma.panel.count({ where: { userId: userId } });
            if (panelCount >= 10) {
                return fail(res, 'Limite de 10 painéis por usuário residencial atingido.', 403);
            }

            const newPanel = await prisma.panel.create({
                data: { serial, location, model, userId: userId } // Vincula ao User
            });
            return success(res, newPanel, 'Painel residencial adicionado com sucesso.');
        }

        // --- LÓGICA PARA USUÁRIO EMPRESARIAL ---
        if (user.role === 'BUSINESS') {
            if (!branchId) {
                return fail(res, 'Para contas empresariais, é necessário informar a filial (branchId).');
            }

            // Verificação de segurança: a filial pertence à empresa do usuário?
            const branch = await prisma.branch.findFirst({
                where: { id: branchId, companyId: user.companyId }
            });
            if (!branch) {
                return fail(res, 'Filial não encontrada ou não pertence à sua empresa.', 404);
            }

            const newPanel = await prisma.panel.create({
                data: { serial, location, model, branchId: branchId } // Vincula à Branch
            });
            return success(res, newPanel, 'Painel empresarial adicionado com sucesso.');
        }

    } catch(err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('serial')) {
            return fail(res, 'Já existe um painel com este número de serial.');
        }
        next(err);
    }
}

// ==================== LISTAR PAINÉIS DO CONTEXTO DO USUÁRIO ====================
async function listMyPanels(req, res, next) {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        let panels;

        if (user.role === 'RESIDENTIAL') {
            panels = await prisma.panel.findMany({
                where: { userId: userId }
            });
        }

        if (user.role === 'BUSINESS') {
            // Lista todos os painéis de todas as filiais da empresa do usuário
            panels = await prisma.panel.findMany({
                where: {
                    branch: {
                        companyId: user.companyId
                    }
                },
                include: { // Inclui o nome da filial para dar contexto
                    branch: {
                        select: { name: true }
                    }
                }
            });
        }

        return success(res, panels, 'Lista de painéis carregada.');

    } catch (err) {
        next(err);
    }
}

// ==================== DETALHES DE UM PAINEL ESPECÍFICO ====================
async function getPanelDetails(req, res, next) {
    try {
        const userId = req.user.id;
        const panelId = parseInt(req.params.id, 10);
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const panel = await prisma.panel.findUnique({ 
            where: { id: panelId },
            include: { branch: true } // Inclui a filial para verificação
        });

        if (!panel) return fail(res, 'Painel não encontrado', 404);

        // Verificação de segurança: o painel pertence ao usuário?
        let isOwner = false;
        if (user.role === 'RESIDENTIAL' && panel.userId === userId) {
            isOwner = true;
        }
        if (user.role === 'BUSINESS' && panel.branch?.companyId === user.companyId) {
            isOwner = true;
        }

        if (!isOwner) {
            return fail(res, 'Você não tem permissão para ver este painel.', 403);
        }

        return success(res, panel);

    } catch (err) {
        next(err);
    }
}


module.exports = {
    addPanel,
    listMyPanels,
    getPanelDetails,
};