const { prisma } = require("../prismaClient");
const { success, fail } = require('../helpers/response');

/**
 * Controller mais defensivo para criar filial.
 * Logs inclusos para debugging (remover em produção).
 */
async function createBranch(req, res, next) {
  try {
    // debug logs — REMOVA depois de diagnosticar
    console.log("CREATE BRANCH - req.user:", req.user);
    console.log("CREATE BRANCH - body:", req.body);

    const user = req.user;
    let { name, address, companyId, tarifaKwh, fatorCo2Kwh } = req.body;

    // Normaliza entrada
    companyId = companyId !== undefined && companyId !== null ? parseInt(companyId, 10) : null;
    tarifaKwh = tarifaKwh !== undefined && tarifaKwh !== null ? Number(tarifaKwh) : undefined;
    fatorCo2Kwh = fatorCo2Kwh !== undefined && fatorCo2Kwh !== null ? Number(fatorCo2Kwh) : undefined;

    if (!name || !companyId) {
      return fail(res, 'O nome da filial e o ID da empresa são obrigatórios.', 400);
    }

    // Verifica autenticação mínima
    if (!user || !user.id) {
      return fail(res, 'Usuário não autenticado.', 401);
    }

    // Se user é BUSINESS, ele só pode criar filiais para a própria empresa
    // Usa comparação numérica defensiva
    if (user.role === 'BUSINESS') {
      const userCompanyId = user.companyId !== undefined && user.companyId !== null ? Number(user.companyId) : null;
      if (!userCompanyId) {
        return fail(res, 'Seu usuário não possui uma empresa vinculada.', 403);
      }
      if (userCompanyId !== companyId) {
        return fail(res, 'Você não tem permissão para criar filiais para esta empresa.', 403);
      }
    }

    // Verifica se a empresa realmente existe
    const companyExists = await prisma.company.findUnique({ where: { id: companyId } });
    if (!companyExists) {
      return fail(res, `A empresa com ID ${companyId} não foi encontrada.`, 404);
    }

    // Preenche valores default caso necessário
    const branchData = {
      name,
      address: address || 'Endereço não informado',
      companyId,
      tarifaKwh: typeof tarifaKwh === 'number' ? tarifaKwh : undefined,
      fatorCo2Kwh: typeof fatorCo2Kwh === 'number' ? fatorCo2Kwh : undefined,
    };

    // Se não enviaram tarifa/fator, não envie undefined explicitamente (Prisma usará default do schema)
    if (branchData.tarifaKwh === undefined) delete branchData.tarifaKwh;
    if (branchData.fatorCo2Kwh === undefined) delete branchData.fatorCo2Kwh;

    const newBranch = await prisma.branch.create({
      data: branchData
    });

    return success(res, newBranch, 201);
  } catch (err) {
    console.error("Erro createBranch:", err);
    next(err);
  }
}

/* restante dos controllers com logs e checagens semelhantes */

async function listBranchesByCompany(req, res, next) {
  try {
    console.log("LIST BRANCHES - req.user:", req.user, "params:", req.params);
    const companyId = parseInt(req.params.companyId, 10);
    const user = req.user;

    if (isNaN(companyId)) return fail(res, 'companyId inválido.', 400);

    if (user.role === 'BUSINESS') {
      const userCompanyId = user.companyId ? Number(user.companyId) : null;
      if (!userCompanyId || userCompanyId !== companyId) {
        return fail(res, 'Você não tem permissão para ver as filiais desta empresa.', 403);
      }
    }

    const branches = await prisma.branch.findMany({
      where: { companyId }
    });
    return success(res, branches);
  } catch (err) {
    console.error("Erro listBranchesByCompany:", err);
    next(err);
  }
}

async function getBranchById(req, res, next) {
  try {
    const branchId = parseInt(req.params.id, 10);
    const user = req.user;

    if (isNaN(branchId)) return fail(res, 'ID da filial inválido.', 400);

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) return fail(res, 'Filial não encontrada.', 404);

    if (user.role === 'BUSINESS') {
      const userCompanyId = user.companyId ? Number(user.companyId) : null;
      if (!userCompanyId || userCompanyId !== branch.companyId) {
        return fail(res, 'Acesso não autorizado a esta filial.', 403);
      }
    }

    return success(res, branch);
  } catch (err) {
    console.error("Erro getBranchById:", err);
    next(err);
  }
}

async function updateBranch(req, res, next) {
  try {
    const branchId = parseInt(req.params.id, 10);
    const user = req.user;
    const { name, address, tarifaKwh, fatorCo2Kwh } = req.body;

    if (isNaN(branchId)) return fail(res, 'ID da filial inválido.', 400);

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) return fail(res, 'Filial não encontrada para atualizar.', 404);

    if (user.role === 'BUSINESS') {
      const userCompanyId = user.companyId ? Number(user.companyId) : null;
      if (!userCompanyId || userCompanyId !== branch.companyId) {
        return fail(res, 'Acesso não autorizado para modificar esta filial.', 403);
      }
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: { name, address, tarifaKwh, fatorCo2Kwh }
    });
    return success(res, updatedBranch);
  } catch (err) {
    console.error("Erro updateBranch:", err);
    next(err);
  }
}

async function deleteBranch(req, res, next) {
  try {
    const branchId = parseInt(req.params.id, 10);
    const user = req.user;

    if (isNaN(branchId)) return fail(res, 'ID da filial inválido.', 400);

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) return fail(res, 'Filial não encontrada para deletar.', 404);

    if (user.role === 'BUSINESS') {
      const userCompanyId = user.companyId ? Number(user.companyId) : null;
      if (!userCompanyId || userCompanyId !== branch.companyId) {
        return fail(res, 'Acesso não autorizado para deletar esta filial.', 403);
      }
    }

    await prisma.branch.delete({ where: { id: branchId } });
    return success(res, { message: 'Filial deletada com sucesso.' });
  } catch (err) {
    console.error("Erro deleteBranch:", err);
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
