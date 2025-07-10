
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Rota GET para buscar todos os logs de auditoria
router.get('/logs', async (req, res) => {
    try {
        const logs = await prisma.logAuditoria.findMany({
            orderBy: {
                criadoEm: 'desc' // Mostra os mais recentes primeiro
            },
            include: {
                usuario: { // Inclui o nome do usuário no log
                    select: { nome: true, email: true }
                }
            }
        });
        res.json(logs);
    } catch (error) {
        console.error("Erro ao buscar logs de auditoria:", error);
        res.status(500).json({ message: 'Erro ao buscar logs de auditoria.' });
    }
});

module.exports = router;
