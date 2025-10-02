const prisma = require("../prismaClient");

async function ingestMeasurement(req, res, next) {
    try {
        // PASSO 2.1: Obter e Validar Dados Essenciais do Dispositivo
        // Esperamos o serial do painel e o valor da energia gerada.
        const serial = req.body.serial && String(req.body.serial).trim();
        const energia_kWh = req.body.energia_kWh;
 
        // Verifica se os dados necessários estão presentes e se a energia é um número.
        if (!serial || typeof energia_kWh !== 'number') {
            return res.status(400).json({ error: 'Serial e energia_kWh são obrigatórios e válidos.' });
        }
 
        // Usa o serial para encontrar o painel e obter o ID interno dele.
        const panel = await prisma.panel.findUnique({
            where: { serial },
            select: { id: true },
        });
 
        if (!panel) {
            // Se o serial não estiver registrado, rejeita a medição.
            return res.status(401).json({ error: 'Painel não autorizado ou não provisionado.' });
        }
 
        // PASSO 2.3: Inserir a Nova Medição
        // Cria um novo registro na tabela 'Measurement'
        const newMeasurement = await prisma.measurement.create({
            data: {
                panelId: panel.id,
                energia_kWh: energia_kWh,
                // Registra o tempo exato em que o servidor recebeu o dado.
                timestamp: new Date(),
            },
        });
 
        // PASSO 2.4: Atualizar o Status 'lastSeen' do Painel
        // Atualiza o painel para indicar que ele está online e se comunicando.
        await prisma.panel.update({
            where: { id: panel.id },
            data: { lastSeen: new Date() },
        });
 
        // PASSO 2.5: Resposta de Sucesso
        // Retorna 202 Accepted, indicando que o dado foi recebido para processamento.
        return res.status(202).json({
            message: 'Medição registrada com sucesso.',
            id: newMeasurement.id,
        });
    } catch (err) {
        // Envia o erro para o manipulador de erros do Express
        next(err);
    }
}

async function ping(req, res) {
  res.json({ ok: true });
}

async function listMeasurementsByPanel(req, res, next) {
  // lógica de listar medições
}

async function getMeasurement(req, res, next) {
  // lógica de buscar uma medição específica
}

async function getSummary(req, res, next) {
  try {
    const panelId = Number(req.params.panelId);
    const days = Number(req.query.days) || 1;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const totalResult = await prisma.measurement.aggregate({
      _sum: { energia_kWh: true },
      where: {
        panelId,
        timestamp: { gte: fromDate },
      },
    });

    res.json({ total: totalResult._sum.energia_kWh || 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ingestMeasurement,
  ping,
  listMeasurementsByPanel,
  getMeasurement,
  getSummary,
};
