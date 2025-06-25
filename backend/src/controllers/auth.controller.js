const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const crypto = require('crypto');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// Esquema de validação para registro
const registerSchema = z.object({
  email: z.string().email('Formato de e-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.'),
  name: z.string().optional(),
});

// Registrar novo usuário
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
      return res.status(400).json({ errors: error.issues });
    }
    res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
};

// Login do usuário
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
      await prisma.loginAttempt.create({ data: { email, ip, success: false, userId: user.id }});
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    await prisma.loginAttempt.create({ data: { email, ip, success: true, userId: user.id }});
    await prisma.auditLog.create({ data: { action: 'USER_LOGIN_SUCCESS', userId: user.id, ip }});

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

// Esqueci minha senha
exports.forgotPassword = async (req, res) => {
    // ... Lógica para gerar token e enviar e-mail (simulado) ...
    res.json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
};

// Redefinir senha
exports.resetPassword = async (req, res) => {
    // ... Lógica para validar token e redefinir a senha ...
    res.json({ message: 'Senha redefinida com sucesso!' });
};