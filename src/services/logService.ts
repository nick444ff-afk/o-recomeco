import prisma from '../config/database';
import { LogEntry } from '../types';

// Buffer de logs em memória para polling rápido do frontend
const logBuffers: Map<string, LogEntry[]> = new Map();

/**
 * Adiciona um log ao sistema.
 * Tipos de cores (via frontend):
 * - info: Ciano (Login / Geral)
 * - success: Verde (Servidores / Cliques / Mensagens)
 * - warn: Amarelo (Avisos)
 * - error: Vermelho (Erros)
 */
export function addLog(botId: string, entry: LogEntry): void {
  const buffer = logBuffers.get(botId) || [];
  
  const now = new Date();
  const hora = now.toLocaleTimeString('pt-BR', { hour12: false });
  
  // Se a mensagem já vier formatada com horário, não duplicamos
  const formattedMessage = entry.message.startsWith('[') 
    ? entry.message 
    : `[${hora}] ${entry.message}`;

  const newEntry = {
    ...entry,
    message: formattedMessage
  };

  buffer.push(newEntry);
  
  // Manter apenas os últimos 200 logs em memória
  if (buffer.length > 200) {
    buffer.shift();
  }
  logBuffers.set(botId, buffer);

  // Salvar no banco de forma assíncrona
  prisma.log.create({
    data: {
      botId,
      type: entry.type,
      message: formattedMessage,
      server: entry.server || '',
      channel: entry.channel || '',
    },
  }).catch((err) => {
    console.error(`[${hora}] [LOG-ERROR]`, err.message);
  });

  // Log no console do backend com cores ANSI para o Railway
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'
  };

  const color = colors[entry.type as keyof typeof colors] || colors.reset;
  console.log(`${color}${formattedMessage}${colors.reset}`);
}

export function getAndClearLogs(botId: string): LogEntry[] {
  const buffer = logBuffers.get(botId) || [];
  logBuffers.set(botId, []);
  return buffer;
}

export function getAllLogs(botId: string): LogEntry[] {
  return logBuffers.get(botId) || [];
}
