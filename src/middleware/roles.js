const { fail } = require('../helpers/response');

/**
 * Middleware de verificação de permissão (role).
 * Ele cria um middleware que verifica se a role do usuário logado está na lista de roles permitidas.
 * @param {string[]} rolesPermitidas - Um array de strings com as roles que têm permissão. Ex: ['ADMIN', 'BUSINESS']
 * @returns um middleware do Express.
 */
const checkRole = (rolesPermitidas) => {

  return (req, res, next) => {
    const userRole = req.user?.role;
    if (userRole && rolesPermitidas.includes(userRole)) {
      next();
    } else {
      fail(res, 'Acesso negado. Você não tem permissão para executar esta ação.', 403);
    }
  };
};

module.exports = { checkRole };