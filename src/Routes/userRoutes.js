const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CREATE
router.post('/', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await prisma.user.create({ data: { name, email, password } });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ ALL
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// READ ONE
router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  res.json(user);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { name, email, password }
    });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Usuário deletado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;