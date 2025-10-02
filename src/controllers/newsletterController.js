const prisma = require('../prismaClient');
const { success, fail } = require('../helpers/response');

async function subscribe(req, res, next) {
  try {
    const email = req.body.email && String(req.body.email).trim().toLowerCase();
    if (!email || !/^[\w-.]+@[\w-]+\.[a-z]{2,}$/i.test(email)) {
      return fail(res, 'E-mail inválido', 400);
    }
    await prisma.newsletterSubscriber.create({ data: { email } });
    return success(res, null, 'Inscrição realizada com sucesso!');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 'E-mail já inscrito', 409);
    next(err);
  }
}

module.exports = { subscribe };