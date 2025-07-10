const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware'); // Nosso "segurança"
const router = express.Router();

// Rota GET /api/users/me
// O authMiddleware vai rodar primeiro, garantindo que só um usuário logado pode acessar.
router.get('/me', authMiddleware, userController.getMe);

module.exports = router;