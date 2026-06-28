import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './routes/api';
import prisma from './config/database';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Servir frontend estático (React build)
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// Compatibilidade com rotas do frontend (sem /api prefix) - apenas se não for arquivo estático
app.use('/', apiRoutes);

// SPA fallback - servir index.html para rotas não encontradas
app.get('*', (_req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ status: 'ok', message: 'SystemX API Online. Frontend não buildado.' });
    }
  });
});

// Inicializar servidor
async function bootstrap() {
  try {
    // Conectar ao banco
    await prisma.$connect();
    console.log('[DATABASE] PostgreSQL conectado com sucesso.');

    // Iniciar servidor HTTP
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] SystemX rodando na porta ${PORT}`);
      console.log(`[SERVER] API: http://localhost:${PORT}/api`);
      console.log(`[SERVER] Frontend: http://localhost:${PORT}`);
    });
  } catch (err: any) {
    console.error('[FATAL] Erro ao inicializar:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] Recebido SIGTERM, encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] Recebido SIGINT, encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED] Promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT] Exception:', err.message);
});

bootstrap();
