const { prisma } = require("../prismaClient");
const { success, fail } = require('../helpers/response');

async function createCompany(req, res, next) {
    try {
        const { name, cnpj } = req.body;
        if (!name || !cnpj) {
            return fail(res, 'Nome e CNPJ são obrigatórios.');
        }

        const newCompany = await prisma.company.create({
            data: { name, cnpj }
        });
        return success(res, newCompany, 201);
    } catch (err) {
        if (err.code === 'P2002') {
            return fail(res, 'Este CNPJ já está cadastrado.');
        }
        next(err);
    }
}

// Listar todas as empresas
async function getAllCompanies(req, res, next) {
    try {
        const companies = await prisma.company.findMany();
        return success(res, companies);
    } catch (err) {
        next(err);
    }
}

// Buscar uma empresa pelo ID
async function getCompanyById(req, res, next) {
    try {
        const companyId = parseInt(req.params.id, 10);
        const user = req.user; 

        if (user.role !== 'ADMIN' && user.companyId !== companyId) {
            return fail(res, 'Acesso não autorizado.', 403); // 403 = Forbidden
        }
        
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) {
            return fail(res, 'Empresa não encontrada.', 404);
        }
        return success(res, company);
    } catch (err) {
        next(err);
    }
}

async function updateCompany(req, res, next) {
    try {
        const companyId = parseInt(req.params.id, 10);
        const { name, cnpj } = req.body;

        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: { name, cnpj }
        });
        return success(res, updatedCompany);
    } catch (err) {
        if (err.code === 'P2025') {
            return fail(res, 'Empresa não encontrada.', 404);
        }
        next(err);
    }
}


async function deleteCompany(req, res, next) {
    try {
        const companyId = parseInt(req.params.id, 10);
        await prisma.company.delete({ where: { id: companyId } });
        return success(res, { message: 'Empresa deletada com sucesso.' });
    } catch (err) {
        if (err.code === 'P2025') {
            return fail(res, 'Empresa não encontrada.', 404);
        }
        next(err);
    }
}

module.exports = {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
};