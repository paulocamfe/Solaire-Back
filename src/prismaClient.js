// Centraliza e compartilha a instância do PrismaClient
// Evita múltiplas instâncias em ambiente de desenvolvimento (hot-reload)
const { PrismaClient } = require('@prisma/client');

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = prisma;