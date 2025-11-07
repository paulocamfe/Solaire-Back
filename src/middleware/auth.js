const jwt = require('jsonwebtoken');
const { prisma } = require('../prismaClient');
const JWT_SECRET = process.env.JWT_SECRET || 'segredo';

module.exports = async function autenticar(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Token necessário' });

    const parts = String(authHeader).split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];

    if (!token) return res.status(401).json({ error: 'Token inválido' });

    const decoded = jwt.verify(token, JWT_SECRET);


    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    req.user = user; 
    next();
  } catch (err) {
    console.error('Erro na autenticação:', err);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
