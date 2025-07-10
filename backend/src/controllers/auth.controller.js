// auth.controller.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const crypto = require('crypto');

// Serviços de e-mail
const { sendPasswordResetEmail, send2FACodeByEmail } = require('../services/email.service');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// --- Registro de Usuário ---
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

// --- Login com suporte a 2FA ---
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      await prisma.loginAttempt.create({ data: { email, ip, success: false } });
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // --- Se o 2FA estiver ativado ---
    if (user.twoFactorEnabled) {
      const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorCode, twoFactorCodeExpiresAt: expiresAt },
      });

      await send2FACodeByEmail(user.email, twoFactorCode);

      return res.status(200).json({ twoFactorRequired: true, userId: user.id });
    }

    // --- Login normal se 2FA não está ativado ---
    await prisma.loginAttempt.create({ data: { email, ip, success: true } });
    await prisma.auditLog.create({ data: { action: 'USER_LOGIN_SUCCESS', userId: user.id, ip } });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });

  } catch (error) {
    console.error("Erro inesperado no login:", error);
    res.status(500).json({ message: 'Erro ao fazer login.' });
  }
};

// --- Esqueci minha senha ---
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'E-mail é obrigatório.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      await prisma.passwordResetToken.create({
        data: { email, token, expiresAt },
      });

      await sendPasswordResetEmail(email, token);
    }

    res.json({
      message: 'Se um e-mail cadastrado com este endereço existir, um link de recuperação foi enviado.',
    });

  } catch (error) {
    console.error("Erro em forgotPassword:", error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

// --- Redefinir Senha ---
const resetPasswordSchema = z.object({
  token: z.string().nonempty({ message: "Token é obrigatório." }),
  password: z.string().min(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' }),
});

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

    await prisma.$transaction([
      prisma.user.update({
        where: { email: tokenRecord.email },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.delete({
        where: { id: tokenRecord.id },
      }),
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
