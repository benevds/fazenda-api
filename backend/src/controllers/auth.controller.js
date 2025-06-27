const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const crypto = require('crypto'); 

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// --- Função de Registro 
const registerSchema = z.object({
  email: z.string().email({ message: 'Formato de e-mail inválido.' }),
  password: z.string().min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),
  name: z.string().min(2, { message: 'O nome é obrigatório.' }),
});

exports.register = async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
    await prisma.auditLog.create({
      data: { action: 'USER_REGISTER_SUCCESS', userId: user.id, ip: req.ip },
    });
    res.status(201).json({ message: 'Usuário criado com sucesso!' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Erro de validação', errors: error.issues });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }
    console.error("Erro no registro:", error);
    res.status(500).json({ message: 'Erro interno ao registrar usuário.' });
  }
};

// --- Função de Login (Sem alterações) ---
exports.login = async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip;
  
    try {
      const user = await prisma.user.findUnique({ where: { email } });
  
      if (!user) {
        await prisma.loginAttempt.create({ data: { email, ip, success: false }});
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }
      
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        await prisma.loginAttempt.create({ data: { email, ip, success: false }});
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }
  
      await prisma.loginAttempt.create({ data: { email, ip, success: true } });
      await prisma.auditLog.create({ data: { action: 'USER_LOGIN_SUCCESS', userId: user.id, ip }});
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      res.json({ message: 'Login bem-sucedido!', token });
  
    } catch (error) {
      console.error("Erro inesperado no login:", error);
      res.status(500).json({ message: 'Erro ao fazer login.' });
    }
};

// --- LÓGICA COMPLETA PARA RECUPERAÇÃO DE SENHA ---

// 1. ESQUECI MINHA SENHA (Gerar o token)
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'E-mail é obrigatório.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // Token expira em 1 hora

            await prisma.passwordResetToken.create({
                data: { email, token, expiresAt },
            });
            
            // SIMULAÇÃO DE ENVIO DE E-MAIL: Mostramos o link no console do backend.
            // Trocar o endereço e porta se o Live Server usar um diferente.
            const liveServerUrl = "http://127.0.0.1:5500";
            console.log('--- [RECUPERAÇÃO DE SENHA] ---');
            console.log(`Token gerado para ${email}: ${token}`);
            console.log('Link para teste (copie e cole no navegador):');
            console.log(`${liveServerUrl}/senha/redefinir.html?token=${token}`);
            console.log('---------------------------------');
        }

        res.json({ message: 'Se um e-mail cadastrado com este endereço existir, um link de recuperação foi enviado.' });

    } catch (error) {
        console.error("Erro em forgotPassword:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// Esquema de validação para a nova senha
const resetPasswordSchema = z.object({
    token: z.string().nonempty({ message: "Token é obrigatório." }),
    password: z.string().min(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' }),
});

// 2. REDEFINIR A SENHA (Validar o token e trocar a senha)
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = resetPasswordSchema.parse(req.body);

        const tokenRecord = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Atualiza a senha do usuário e deleta o token usado
        await prisma.$transaction([
            prisma.user.update({
                where: { email: tokenRecord.email },
                data: { password: hashedPassword },
            }),
            prisma.passwordResetToken.delete({
                where: { id: tokenRecord.id },
            })
        ]);

        res.json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ errors: error.issues });
        }
        console.error("Erro em resetPassword:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
