const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CREATE
router.post('/', async (req, res) => {
  const { panelId, voltage, current, power, temperature, consumption, status } = req.body;
  try {
    const measurement = await prisma.measurement.create({
      data: { panelId, voltage, current, power, temperature, consumption, status }
    });
    res.json(measurement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ ALL
router.get('/', async (req, res) => {
  const measurements = await prisma.measurement.findMany();
  res.json(measurements);
});

// READ ONE
router.get('/:id', async (req, res) => {
  const measurement = await prisma.measurement.findUnique({ where: { id: Number(req.params.id) } });
  res.json(measurement);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { panelId, voltage, current, power, temperature, consumption, status } = req.body;
  try {
    const measurement = await prisma.measurement.update({
      where: { id: Number(req.params.id) },
      data: { panelId, voltage, current, power, temperature, consumption, status }
    });
    res.json(measurement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await prisma.measurement.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Medição deletada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;