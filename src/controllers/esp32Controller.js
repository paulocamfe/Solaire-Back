const { prisma } = require("../prismaClient");

/**
 * Recebe dados do ESP32 e salva no banco
 */
exports.receiveMeasurements = async (req, res) => {
  try {
    const { serial, voltage, current, power, temperature } = req.body;

    if (!serial) {
      return res.status(400).json({ error: "Serial do painel é obrigatório." });
    }

    // Verificar se existe um painel com esse serial
    let panel = await prisma.panel.findUnique({
      where: { serial },
    });

    if (!panel) {
      // Se não existir, cria automaticamente
      panel = await prisma.panel.create({
        data: {
          serial,
          model: "ESP32-Solaire",
          location: "Não definida",
          status: "ONLINE",
        },
      });
    }

    // Salvar a medição
    const measurement = await prisma.measurement.create({
      data: {
        panelId: panel.id,
        energia_kWh: power / 1000 / 60, // exemplo: transformar W→kWh (1 min)
        status: "OK",
      },
    });

    // Atualiza lastSeen do painel
    await prisma.panel.update({
      where: { id: panel.id },
      data: { lastSeen: new Date(), status: "ONLINE" },
    });

    return res.status(200).json({
      message: "Dados recebidos com sucesso!",
      saved: {
        panel: panel.serial,
        voltage,
        current,
        power,
        temperature,
      },
    });
  } catch (error) {
    console.error("Erro ao salvar dados do ESP32:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
};
