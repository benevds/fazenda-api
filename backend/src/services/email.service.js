const nodemailer = require('nodemailer');

async function sendPasswordResetEmail(email, token) {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Usa o serviço do Gmail
        auth: {
            user: process.env.GMAIL_USER,       // Seu e-mail do arquivo .env
            pass: process.env.GMAIL_APP_PASSWORD, // Sua senha de app de 16 letras do .env
        },
    });

    const liveServerUrl = "http://127.0.0.1:5500"; // Mude se seu Live Server usa outra porta
    const resetLink = `${liveServerUrl}/senha/redefinir.html?token=${token}`;

    const mailOptions = {
        from: `"FazendaWeb" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Recuperação de Senha - FazendaWeb',
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 600px; margin: auto;">
                <h2 style="color: #27ae60;">Recuperação de Senha</h2>
                <p>Olá!</p>
                <p>Recebemos uma solicitação para redefinir a senha da sua conta no FazendaWeb.</p>
                <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.</p>
                <a href="${resetLink}" style="background-color: #27ae60; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; font-weight: bold;">
                    Redefinir Minha Senha
                </a>
                <p style="margin-top: 20px; font-size: 12px; color: #777;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`E-mail de recuperação enviado para ${email} via Gmail.`);
    } catch (error) {
        console.error('Erro ao enviar e-mail pelo Gmail:', error);
        throw new Error('Falha ao enviar o e-mail de recuperação.');
    }
}

// --- NOVA FUNÇÃO ADICIONADA ---
// Envia o código de 6 dígitos para o e-mail do usuário
async function send2FACodeByEmail(email, code) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: `"Smartfarm" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Seu Código de Verificação - Smartfarm',
        html: `<p>Seu código de verificação é: <strong>${code}</strong>. Ele é válido por 10 minutos.</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Código 2FA enviado para ${email} via Gmail.`);
    } catch (error) {
        console.error('Erro ao enviar código 2FA pelo Gmail:', error);
        throw new Error('Falha ao enviar o código de verificação.');
    }
}

// Exporta ambas as funções
module.exports = {
    sendPasswordResetEmail,
    send2FACodeByEmail
};
