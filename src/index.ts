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

// Servir arquivos estáticos com cache desativado
app.use(express.static(frontendPath, { etag: false, lastModified: false }));

// Fallback para SPA (Configuração de Sucesso)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  const indexPath = path.join(frontendPath, 'index.html');
  res.sendFile(indexPath, { etag: false, lastModified: false }, (err) => {
    if (err) {
      res.status(500).send("Painel em construção... Atualize em 1 minuto.");
    }
  });
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
