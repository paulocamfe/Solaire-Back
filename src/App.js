const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();

app.use(express.json());

const userRoutes = require('./Routes/userRoutes');
const panelRoutes = require('./Routes/panelRoutes');
const measurementRoutes = require('./Routes/measurementRoutes');


app.use('/users', userRoutes);
app.use('/panels', panelRoutes);
app.use('/measurements', measurementRoutes);


// Cadastro de usuário
app.post('/users', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await prisma.user.create({
      data: { name, email, password }
    });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Vincular placa ao usuário pelo código (serial)
app.post('/panels/link', async (req, res) => {
  const { userId, serial } = req.body;
  try {
    const panel = await prisma.panel.update({
      where: { serial },
      data: { userId }
    });
    res.json(panel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Registrar medição
app.post('/measurements', async (req, res) => {
  const { panelId, voltage, current, power, temperature, consumption, status } = req.body;
  try {
    const measurement = await prisma.measurement.create({
      data: {
        panelId,
        voltage,
        current,
        power,
        temperature,
        consumption,
        status
      }
    });
    res.json(measurement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar medições de uma placa
app.get('/panels/:panelId/measurements', async (req, res) => {
  const { panelId } = req.params;
  try {
    const measurements = await prisma.measurement.findMany({
      where: { panelId: Number(panelId) }
    });
    res.json(measurements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Iniciar servidor
app.listen(3306, () => {
  console.log('API rodando na porta 3306');
});