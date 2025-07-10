const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

// Função para ATIVAR ou DESATIVAR o 2FA
exports.toggle2FA = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
        const newStatus = !user.twoFactorEnabled;

        await prisma.user.update({
            where: { id: req.user.userId },
            data: { twoFactorEnabled: newStatus },
        });

        res.json({ message: `Autenticação de dois fatores ${newStatus ? 'ativada' : 'desativada'} com sucesso!` });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao alterar status do 2FA.' });
    }
};

// Função para VERIFICAR o código de 6 dígitos
exports.verifyLoginToken = async (req, res) => {
    const { userId, token } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || user.twoFactorCode !== token || user.twoFactorCodeExpiresAt < new Date()) {
            return res.status(400).json({ message: 'Código inválido ou expirado.' });
        }

        const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Verificação bem-sucedida!', token: accessToken });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};