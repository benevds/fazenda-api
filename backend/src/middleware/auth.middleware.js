const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (token == null) {
        return res.sendStatus(401); // Se não há token, não autorizado
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Se o token for inválido, acesso proibido
        }
        
        // Se o token for válido, adicionamos os dados do usuário na requisição
        req.user = user;
        next(); // Pode prosseguir para a rota principal
    });
}

module.exports = authMiddleware;