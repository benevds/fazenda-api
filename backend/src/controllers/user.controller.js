const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Função para buscar os dados do usuário que está logado
exports.getMe = async (req, res) => {
    try {
        // O ID do usuário vem do token que o middleware de autenticação validou
        const userId = req.user.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            // Seleciona apenas os campos seguros para enviar de volta
            select: {
                id: true,
                email: true,
                name: true,
                twoFactorEnabled: true // Importante para o frontend saber o status do 2FA
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        res.json(user);

    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar informações do usuário.' });
    }
};