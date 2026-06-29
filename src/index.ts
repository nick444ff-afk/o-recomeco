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
const frontendPath = path.resolve(__dirname, '../frontend/dist');

// Servir arquivos estáticos
app.use(express.static(frontendPath, { etag: false }));

// Servir index.html para qualquer rota (SPA Fallback)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API not found' });
  res.sendFile(path.join(frontendPath, 'index.html'), { etag: false });
});

async function bootstrap() {
  try {
    console.log('[BOOTSTRAP] Iniciando servidor...');
    const fs = require('fs');
    if (fs.existsSync(frontendPath)) {
      console.log('[SERVER] Frontend dist encontrado:', fs.readdirSync(frontendPath));
    } else {
      console.error('[SERVER] Frontend dist NÃO encontrado no caminho:', frontendPath);
    }
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
