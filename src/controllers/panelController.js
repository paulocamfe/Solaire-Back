const { prisma } = require('../prismaClient');
const { success, fail } = require('../helpers/response');

// ==================== ADICIONAR UM PAINEL ====================
async function addPanel(req, res, next) {
    try {
        console.log('📥 Dados recebidos no addPanel:', req.body);
        console.log('👤 Usuário autenticado:', req.user);
        
        const userId = req.user.id;
        const { serial, location, model, branchId } = req.body;

        // ✅ APENAS serial e location são obrigatórios (model é opcional)
        if (!serial) {
            console.log('❌ Serial faltando');
            return fail(res, 'Serial da placa é obrigatório.', 400);
        }

        if (!location) {
            console.log('❌ Location faltando');
            return fail(res, 'Localização é obrigatória.', 400);
        }

        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { company: true }
        });

        console.log('👤 Usuário encontrado:', user);

        if (!user) {
            return fail(res, 'Usuário não encontrado.', 404);
        }

        // --- USUÁRIO RESIDENCIAL ---
        if (user.role === 'RESIDENTIAL') {
            console.log('🏠 Usuário residencial detectado');
            
            // Verificar se placa já existe
            const existingPanel = await prisma.panel.findFirst({
                where: { 
                    serial: serial,
                    userId: userId
                }
            });

            if (existingPanel) {
                console.log('❌ Placa já existe para este usuário:', existingPanel);
                return fail(res, 'Já existe um painel com este serial no seu sistema.', 409);
            }

            const panelCount = await prisma.panel.count({ where: { userId: userId } });
            if (panelCount >= 10) {
                return fail(res, 'Limite de 10 painéis por usuário residencial atingido.', 403);
            }

            const newPanel = await prisma.panel.create({
                data: { 
                    serial, 
                    location, 
                    model: model || 'Genérico', // ✅ Valor padrão se não enviado
                    userId: userId,
                    status: 'Ativa',
                    energia_kWh: 0,
                    tensao: 0,
                    temperatura: 0
                }
            });

            console.log('✅ Painel residencial criado:', newPanel);
            return success(res, { panel: newPanel }, 'Painel residencial adicionado com sucesso.');
        }

        // --- USUÁRIO EMPRESARIAL ---
        if (user.role === 'BUSINESS') {
            console.log('🏢 Usuário empresarial detectado');
            
            if (!branchId) {
                return fail(res, 'Para contas empresariais, é necessário informar a filial (branchId).', 400);
            }

            if (!user.companyId) {
                console.log('❌ Usuário BUSINESS sem companyId');
                return fail(res, 'Usuário empresarial não vinculado a uma empresa.', 400);
            }

            const branch = await prisma.branch.findFirst({
                where: { 
                    id: branchId, 
                    companyId: user.companyId 
                }
            });
            
            if (!branch) {
                console.log('❌ Filial não encontrada:', { branchId, companyId: user.companyId });
                return fail(res, 'Filial não encontrada ou não pertence à sua empresa.', 404);
            }

            // Verificar se placa já existe na empresa
            const existingPanel = await prisma.panel.findFirst({
                where: { 
                    serial: serial,
                    branch: {
                        companyId: user.companyId
                    }
                }
            });

            if (existingPanel) {
                console.log('❌ Placa já existe na empresa:', existingPanel);
                return fail(res, 'Já existe um painel com este serial na sua empresa.', 409);
            }

            const newPanel = await prisma.panel.create({
                data: { 
                    serial, 
                    location, 
                    model: model || 'Genérico', // ✅ Valor padrão se não enviado
                    branchId: branchId,
                    status: 'Ativa',
                    energia_kWh: 0,
                    tensao: 0,
                    temperatura: 0
                }
            });

            console.log('✅ Painel empresarial criado:', newPanel);
            return success(res, { panel: newPanel }, 'Painel empresarial adicionado com sucesso.');
        }

        // Caso o role não seja reconhecido
        return fail(res, 'Tipo de usuário não suportado.', 400);

    } catch(err) {
        console.error('❌ Erro no addPanel:', err);
        
        if (err.code === 'P2002' && err.meta?.target?.includes('serial')) {
            return fail(res, 'Já existe um painel com este número de serial.', 409);
        }
        
        // Outros erros do Prisma
        if (err.code === 'P2025') {
            return fail(res, 'Registro não encontrado no banco de dados.', 404);
        }
        
        return fail(res, 'Erro interno do servidor ao adicionar painel.', 500);
    }
}

// ==================== LISTAR PAINÉIS DO USUÁRIO ====================
async function listMyPanels(req, res, next) {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { company: true }
        });
        
        let panels;

        if (user.role === 'RESIDENTIAL') {
            panels = await prisma.panel.findMany({ 
                where: { userId: userId },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (user.role === 'BUSINESS') {
            panels = await prisma.panel.findMany({
                where: { branch: { companyId: user.companyId } },
                include: { 
                    branch: { 
                        select: { 
                            id: true,
                            name: true,
                            address: true 
                        } 
                    } 
                },
                orderBy: { createdAt: 'desc' }
            });
        }

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
        
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { company: true }
        });

        const panel = await prisma.panel.findUnique({ 
            where: { id: panelId },
            include: { 
                branch: true,
                measurements: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!panel) {
            return fail(res, 'Painel não encontrado', 404);
        }

        // Verificação de propriedade
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

        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { company: true }
        });

        // Buscar painel e verificar propriedade
        const panel = await prisma.panel.findUnique({
            where: { id: panelId },
            include: { branch: true }
        });

        if (!panel) {
            return fail(res, 'Painel não encontrado.', 404);
        }

        // Verificar propriedade
        let isOwner = false;
        if (user.role === 'RESIDENTIAL' && panel.userId === userId) {
            isOwner = true;
        }
        if (user.role === 'BUSINESS' && panel.branch?.companyId === user.companyId) {
            isOwner = true;
        }

        if (!isOwner) {
            return fail(res, 'Você não tem permissão para atualizar este painel.', 403);
        }

        // Atualizar painel
        const updatedPanel = await prisma.panel.update({
            where: { id: panelId },
            data: {
                ...(location && { location }),
                ...(status && { status })
            }
        });

        return success(res, { panel: updatedPanel }, 'Painel atualizado com sucesso.');

    } catch (err) {
        console.error('❌ Erro no updatePanel:', err);
        
        if (err.code === 'P2025') {
            return fail(res, 'Painel não encontrado.', 404);
        }
        
        next(err);
    }
}

// ==================== DELETAR UM PAINEL ====================
async function deletePanel(req, res, next) {
    try {
        const userId = req.user.id;
        const panelId = parseInt(req.params.id, 10);

        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { company: true }
        });

        // Buscar painel e verificar propriedade
        const panel = await prisma.panel.findUnique({
            where: { id: panelId },
            include: { branch: true }
        });

        if (!panel) {
            return fail(res, 'Painel não encontrado.', 404);
        }

        // Verificar propriedade
        let isOwner = false;
        if (user.role === 'RESIDENTIAL' && panel.userId === userId) {
            isOwner = true;
        }
        if (user.role === 'BUSINESS' && panel.branch?.companyId === user.companyId) {
            isOwner = true;
        }

        if (!isOwner) {
            return fail(res, 'Você não tem permissão para deletar este painel.', 403);
        }

        // Deletar painel
        await prisma.panel.delete({
            where: { id: panelId }
        });

        return success(res, null, 'Painel deletado com sucesso.');

    } catch (err) {
        console.error('❌ Erro no deletePanel:', err);
        
        if (err.code === 'P2025') {
            return fail(res, 'Painel não encontrado.', 404);
        }
        
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