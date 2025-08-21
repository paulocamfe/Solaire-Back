const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CREATE
router.post('/', async (req, res) => {
  const { serial, location, model, installedAt, userId } = req.body;
  try {
    const panel = await prisma.panel.create({
      data: { serial, location, model, installedAt, userId }
    });
    res.json(panel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ ALL
router.get('/', async (req, res) => {
  const panels = await prisma.panel.findMany();
  res.json(panels);
});

// READ ONE
router.get('/:id', async (req, res) => {
  const panel = await prisma.panel.findUnique({ where: { id: Number(req.params.id) } });
  res.json(panel);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { serial, location, model, installedAt, userId } = req.body;
  try {
    const panel = await prisma.panel.update({
      where: { id: Number(req.params.id) },
      data: { serial, location, model, installedAt, userId }
    });
    res.json(panel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await prisma.panel.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Placa deletada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;