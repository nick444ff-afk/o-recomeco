import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './routes/api';
import prisma from './config/database';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Caminho do Frontend
const frontendPath = path.join(process.cwd(), 'frontend', 'dist');

// Servir arquivos estáticos
app.use(express.static(frontendPath));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: `Route ${req.method}:${req.path} not found` });
  }
  
  const indexPath = path.join(frontendPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ status: 'ok', message: 'SystemX API Online. Frontend em desenvolvimento.' });
    }
  });
});

async function bootstrap() {
  try {
    console.log('[BOOTSTRAP] Iniciando servidor...');
    await prisma.$connect();
    console.log('[DATABASE] PostgreSQL conectado.');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Rodando na porta ${PORT}`);
      console.log(`[SERVER] Frontend path: ${frontendPath}`);
    });
  } catch (err: any) {
    console.error('[FATAL] Erro:', err.message);
    process.exit(1);
  }
}

bootstrap();
