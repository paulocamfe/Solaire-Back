const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'insecure_secret_fallback';

module.exports = function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token necessário' });

  // aceita "Bearer <token>" ou só "<token>"
  const parts = String(authHeader).split(' ');
  const token = parts.length === 2 ? parts[1] : parts[0];

  if (!token) return res.status(401).json({ error: 'Token inválido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};