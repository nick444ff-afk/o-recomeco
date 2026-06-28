import prisma from '../config/database';
import { LogEntry } from '../types';

// Buffer de logs em memória para polling rápido do frontend
const logBuffers: Map<string, LogEntry[]> = new Map();

export function addLog(botId: string, entry: LogEntry): void {
  const buffer = logBuffers.get(botId) || [];
  buffer.push(entry);
  // Manter apenas os últimos 200 logs em memória
  if (buffer.length > 200) {
    buffer.shift();
  }
  logBuffers.set(botId, buffer);

  const now = new Date();
  const hora = now.toLocaleTimeString('pt-BR', { hour12: false });
  const formattedMessage = `[${hora}] ${entry.message}`;

  // Salvar no banco de forma assíncrona (fire and forget)
  prisma.log.create({
    data: {
      botId,
      type: entry.type,
      message: formattedMessage,
      server: entry.server || '',
      channel: entry.channel || '',
    },
  }).catch((err) => {
    console.error('[LOG-SERVICE] Erro ao salvar log no banco:', err.message);
  });

  // Log no console do backend
  console.log(`[${botId}] ${formattedMessage}`);
  
  // Atualizar a mensagem no buffer para o frontend
  entry.message = formattedMessage;
}

export function getAndClearLogs(botId: string): LogEntry[] {
  const buffer = logBuffers.get(botId) || [];
  logBuffers.set(botId, []);
  return buffer;
}

export function getAllLogs(botId: string): LogEntry[] {
  return logBuffers.get(botId) || [];
}
