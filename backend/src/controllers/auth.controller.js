const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// Esquema de validação para o registro (versão final)
const registerSchema = z.object({
  email: z.string().email({ message: 'Formato de e-mail inválido.' }),
  password: z.string().min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),
  name: z.string().min(2, { message: 'O nome é obrigatório.' }),
});

// Registrar novo usuário
exports.register = async (req, res) => {
  try {
    // 1. Valida os dados que chegam do frontend
    const { email, password, name } = registerSchema.parse(req.body);

    // 2. Criptografa a senha antes de salvar
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // 3. Salva o novo usuário no banco de dados
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    // 4. Cria um log de auditoria
    await prisma.auditLog.create({
      data: { action: 'USER_REGISTER_SUCCESS', userId: user.id, ip: req.ip },
    });

    // 5. Envia uma resposta de sucesso para o frontend
    res.status(201).json({ message: 'Usuário criado com sucesso!' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Erro de validação', errors: error.issues });
    }
    // Verifica se o erro é de e-mail já existente
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }
    console.error("Erro no registro:", error); // Loga o erro no terminal do backend para debug
    res.status(500).json({ message: 'Erro interno ao registrar usuário.' });
  }
};

// Login do usuário
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Se o usuário não existe, a falha é registrada
    if (!user) {
      await prisma.loginAttempt.create({ data: { email, ip, success: false }});
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // Compara a senha enviada com a senha criptografada no banco
    const isMatch = await bcrypt.compare(password, user.password);

    // Se a senha não bate, a falha é registrada
    if (!isMatch) {
      await prisma.loginAttempt.create({ data: { email, ip, success: false, userId: user.id }});
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // Se deu tudo certo, registra o sucesso e a auditoria
    await prisma.loginAttempt.create({ data: { email, ip, success: true, userId: user.id }});
    await prisma.auditLog.create({ data: { action: 'USER_LOGIN_SUCCESS', userId: user.id, ip }});

    // Cria um token de acesso para o usuário
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });

  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ message: 'Erro ao fazer login.' });
  }
};

// Esqueci minha senha (lógica a ser implementada no futuro)
exports.forgotPassword = async (req, res) => {
    // Futuramente: gerar token, salvar no banco, enviar e-mail...
    res.json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
};

// Redefinir senha (lógica a ser implementada no futuro)
exports.resetPassword = async (req, res) => {
    // Futuramente: validar token, verificar expiração, atualizar senha...
    res.json({ message: 'Senha redefinida com sucesso!' });
};
