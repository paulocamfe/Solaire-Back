const prisma = require('../prismaClient');

// Referência global para fazer broadcast
let broadcastFunction = null;

function setBroadcastFunction(fn) {
  broadcastFunction = fn;
}

const receiveData = async (req, res) => {
  try {
    const data = req.body;
    console.log('🔆 Dados recebidos do ESP32:', data);

    // Se houver função broadcast, envia via WebSocket
    if (broadcastFunction) {
      broadcastFunction({ type: 'update', payload: data });
      console.log('📢 Broadcast enviado para WebSocket');
    }

    // Salvar no banco de dados (opcional)
    if (data.panelId && data.tensao && data.corrente && data.potencia) {
      try {
        await prisma.measurement.create({
          data: {
            panelId: parseInt(data.panelId),
            temperatura: parseFloat(data.temperatura) || 0,
            corrente: parseFloat(data.corrente),
            tensao: parseFloat(data.tensao),
            potencia: parseFloat(data.potencia),
            timestamp: new Date(),
          },
        });
        console.log('✅ Dados salvos no banco');
      } catch (dbErr) {
        console.warn('⚠️ Erro ao salvar no banco (continuando):', dbErr.message);
      }
    }

    res.status(200).json({ 
      message: 'OK, recebido!', 
      received: data,
      broadcast: broadcastFunction ? 'enviado' : 'não inicializado'
    });
  } catch (err) {
    console.error('❌ Erro ao processar dados:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { receiveData, setBroadcastFunction };