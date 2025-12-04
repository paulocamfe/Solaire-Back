const prisma = require('../prismaClient');
const { sendMail } = require('../helpers/mailer');

const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data, message });
};

const fail = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error });
};

// ==================== CRIAR TICKET DE SUPORTE ====================
async function createSupport(req, res, next) {
  try {
    const { email, assunto, mensagem } = req.body;

    if (!email || !assunto || !mensagem) {
      return fail(res, 'Email, assunto e mensagem são obrigatórios.');
    }

    const ticket = await prisma.support.create({
      data: {
        email,
        assunto,
        mensagem,
        status: 'ABERTO',
      },
    });

    // Enviar email de confirmação
    try {
      await sendMail({
        to: email,
        subject: `Ticket de Suporte Recebido: #${ticket.id}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Seu ticket foi recebido!</h2>
            <p><strong>ID do Ticket:</strong> #${ticket.id}</p>
            <p><strong>Assunto:</strong> ${assunto}</p>
            <p><strong>Status:</strong> Aberto</p>
            <p>Obrigado por entrar em contato. Nossa equipe responderá em breve!</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.warn('⚠️ Erro ao enviar email de confirmação:', mailErr.message);
    }

    return success(res, ticket, 'Ticket de suporte criado com sucesso', 201);
  } catch (err) {
    next(err);
  }
}

// ==================== LISTAR TICKETS DE SUPORTE ====================
async function getSupport(req, res, next) {
  try {
    const tickets = await prisma.support.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return success(res, tickets, 'Tickets de suporte listados com sucesso');
  } catch (err) {
    next(err);
  }
}

// ==================== DELETAR TICKET DE SUPORTE ====================
async function deleteSupport(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = await prisma.support.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ticket) {
      return fail(res, 'Ticket não encontrado', 404);
    }

    await prisma.support.delete({
      where: { id: parseInt(id) },
    });

    return success(res, null, 'Ticket deletado com sucesso');
  } catch (err) {
    next(err);
  }
}

module.exports = { createSupport, getSupport, deleteSupport };
