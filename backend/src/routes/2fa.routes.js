const express = require('express');
const twoFactorController = require('../controllers/2fa.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Rota para ligar/desligar o 2FA
router.post('/toggle', authMiddleware, twoFactorController.toggle2FA);
// Rota para verificar o código do e-mail
router.post('/verify-login', twoFactorController.verifyLoginToken);

module.exports = router;