// 1. A primeira linha de todas tem que ser esta.
require('dotenv').config();

// 2. Agora sim, a gente importa o resto das ferramentas
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const twoFactorRoutes = require('./routes/2fa.routes');
const userRoutes = require('./routes/user.routes'); // <-- CORRIGIDO
const auditRoutes = require('./routes/audit.routes');

// 3. Cria o servidor
const app = express();
const PORT = process.env.PORT || 3000;

// 4. Configura o servidor
app.use(cors());
app.use(express.json());
app.set('trust proxy', 1);

// 5. "Pendura" as rotas no servidor
app.get('/', (req, res) => {
  res.send('API do Smartfarm está no ar!');
});

app.use('/api/auth', authRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/users', userRoutes); // <-- Agora usa a variável correta
app.use('/api/audit', auditRoutes);

// 6. Liga o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});