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

// Caminho do Frontend (Configuração de Sucesso)
const frontendPath = path.resolve(process.cwd(), 'frontend/dist');

// Servir arquivos estáticos da pasta assets explicitamente
app.use('/assets', express.static(path.join(frontendPath, 'assets'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// Servir o restante da pasta dist
app.use(express.static(frontendPath));

// Fallback para SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  res.sendFile(path.join(frontendPath, 'index.html'));
});

async function bootstrap() {
  try {
    console.log('[BOOTSTRAP] Iniciando servidor...');
    const fs = require('fs');
    
    // Log de diagnóstico
    if (fs.existsSync(frontendPath)) {
      console.log('[SERVER] Frontend dist encontrado:', fs.readdirSync(frontendPath));
    } else {
      console.error('[SERVER] Frontend dist NÃO encontrado em:', frontendPath);
    }

    await prisma.$connect();
    console.log('[DATABASE] Conectado.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Rodando na porta ${PORT}`);
    });
  } catch (err: any) {
    console.error('[FATAL] Erro:', err.message);
    process.exit(1);
  }
}

bootstrap();
