const { prisma } = require("../prismaClient");
const { success, fail } = require('../helpers/response');

async function createBranch(req, res, next) {
    try {
        const { name, address, companyId, tarifaKwh, fatorCo2Kwh } = req.body;
        const user = req.user;

        if (!name || !companyId) {
            return fail(res, 'O nome da filial e o ID da empresa são obrigatórios.');
        }

        if (user.role === 'BUSINESS' && user.companyId !== companyId) {
            return fail(res, 'Você não tem permissão para criar filiais para esta empresa.', 403);
        }
        const companyExists = await prisma.company.findUnique({ where: { id: companyId }});
        if (!companyExists) {
            return fail(res, `A empresa com ID ${companyId} não foi encontrada.`, 404);
        }

        const newBranch = await prisma.branch.create({
            data: { name, address, companyId, tarifaKwh, fatorCo2Kwh }
        });
        return success(res, newBranch, 201); 
    } catch (err) {
        next(err);
    }
}

async function listBranchesByCompany(req, res, next) {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        const user = req.user;
        if (user.role === 'BUSINESS' && user.companyId !== companyId) {
            return fail(res, 'Você não tem permissão para ver as filiais desta empresa.', 403);
        }

        const branches = await prisma.branch.findMany({
            where: { companyId }
        });
        return success(res, branches);
    } catch (err) {
        next(err);
    }
}

async function getBranchById(req, res, next) {
    try {
        const branchId = parseInt(req.params.id, 10);
        const user = req.user;

        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            return fail(res, 'Filial não encontrada.', 404);
        }
        if (user.role === 'BUSINESS' && user.companyId !== branch.companyId) {
            return fail(res, 'Acesso não autorizado a esta filial.', 403);
        }

        return success(res, branch);
    } catch (err) {
        next(err);
    }
}

async function updateBranch(req, res, next) {
    try {
        const branchId = parseInt(req.params.id, 10);
        const user = req.user;
        const { name, address, tarifaKwh, fatorCo2Kwh } = req.body;

        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            return fail(res, 'Filial não encontrada para atualizar.', 404);
        }
        if (user.role === 'BUSINESS' && user.companyId !== branch.companyId) {
            return fail(res, 'Acesso não autorizado para modificar esta filial.', 403);
        }

        const updatedBranch = await prisma.branch.update({
            where: { id: branchId },
            data: { name, address, tarifaKwh, fatorCo2Kwh }
        });
        return success(res, updatedBranch);
    } catch (err) {
        next(err);
    }
}
async function deleteBranch(req, res, next) {
    try {
        const branchId = parseInt(req.params.id, 10);
        const user = req.user;

        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            return fail(res, 'Filial não encontrada para deletar.', 404);
        }
        if (user.role === 'BUSINESS' && user.companyId !== branch.companyId) {
            return fail(res, 'Acesso não autorizado para deletar esta filial.', 403);
        }
        
        await prisma.branch.delete({ where: { id: branchId } });
        return success(res, { message: 'Filial deletada com sucesso.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createBranch,
    listBranchesByCompany,
    getBranchById,
    updateBranch,
    deleteBranch
};