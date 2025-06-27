const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const { z } = require('zod');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const registerSchema = z.object({
  email: z.string().email({ message: 'Formato de e-mail inválido.' }),
  password: z.string().min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),
  name: z.string().min(2, { message: 'O nome é obrigatório.' }),
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
      return res.status(400).json({ message: 'Erro de validação', errors: error.issues });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }
    console.error("Erro no registro:", error);
    res.status(500).json({ message: 'Erro interno ao registrar usuário.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  console.log('--- [LOGIN] Tentativa Recebida ---');
  console.log('E-mail recebido do form:', email);
  console.log('Senha recebida do form:', password);
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log('Resultado da busca: Usuário NÃO encontrado.');
      await prisma.loginAttempt.create({ data: { email, ip, success: false }});
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    
    console.log('Resultado da busca: Usuário encontrado!', user);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Resultado da comparação de senha (bcrypt.compare):', isMatch);

    if (!isMatch) {
      // Aqui nós temos o user.id, então podemos guardar
      await prisma.loginAttempt.create({ data: { email, ip, success: false }});
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    await prisma.loginAttempt.create({
      data: { email, ip, success: true },
    });
    // ----------------------------

    await prisma.auditLog.create({ data: { action: 'USER_LOGIN_SUCCESS', userId: user.id, ip }});
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });

  } catch (error) {
    console.error("Erro inesperado no login:", error);
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
