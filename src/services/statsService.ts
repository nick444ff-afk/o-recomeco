import prisma from '../config/database';

// Stats em memória para acesso rápido
const statsCache: Map<string, {
  entradas: number;
  na_fila: number;
  partidas: number;
  dms: number;
  executions: number;
  serversProcessed: number;
  messagesProcessed: number;
  buttonsClicked: number;
  messagesSent: number;
  errors: number;
  lastExecution: Date | null;
}> = new Map();

function getOrCreateStats(botId: string) {
  if (!statsCache.has(botId)) {
    statsCache.set(botId, {
      entradas: 0,
      na_fila: 0,
      partidas: 0,
      dms: 0,
      executions: 0,
      serversProcessed: 0,
      messagesProcessed: 0,
      buttonsClicked: 0,
      messagesSent: 0,
      errors: 0,
      lastExecution: null,
    });
  }
  return statsCache.get(botId)!;
}

export function getStats(botId: string) {
  return getOrCreateStats(botId);
}

export function incrementStat(botId: string, field: string, amount: number = 1): void {
  const stats = getOrCreateStats(botId);
  if (field in stats && typeof (stats as any)[field] === 'number') {
    (stats as any)[field] += amount;
  }
}

export function setStat(botId: string, field: string, value: any): void {
  const stats = getOrCreateStats(botId);
  if (field in stats) {
    (stats as any)[field] = value;
  }
}

export function resetStats(botId: string): void {
  statsCache.set(botId, {
    entradas: 0,
    na_fila: 0,
    partidas: 0,
    dms: 0,
    executions: 0,
    serversProcessed: 0,
    messagesProcessed: 0,
    buttonsClicked: 0,
    messagesSent: 0,
    errors: 0,
    lastExecution: null,
  });

  // Atualizar no banco
  prisma.stats.upsert({
    where: { botId },
    update: {
      executions: 0,
      serversProcessed: 0,
      messagesProcessed: 0,
      buttonsClicked: 0,
      messagesSent: 0,
      errors: 0,
      lastExecution: null,
    },
    create: {
      botId,
      executions: 0,
      serversProcessed: 0,
      messagesProcessed: 0,
      buttonsClicked: 0,
      messagesSent: 0,
      errors: 0,
    },
  }).catch((err) => {
    console.error('[STATS] Erro ao resetar stats no banco:', err.message);
  });
}

export function persistStats(botId: string): void {
  const stats = getOrCreateStats(botId);
  prisma.stats.upsert({
    where: { botId },
    update: {
      executions: stats.executions,
      serversProcessed: stats.serversProcessed,
      messagesProcessed: stats.messagesProcessed,
      buttonsClicked: stats.buttonsClicked,
      messagesSent: stats.messagesSent,
      errors: stats.errors,
      lastExecution: stats.lastExecution,
    },
    create: {
      botId,
      executions: stats.executions,
      serversProcessed: stats.serversProcessed,
      messagesProcessed: stats.messagesProcessed,
      buttonsClicked: stats.buttonsClicked,
      messagesSent: stats.messagesSent,
      errors: stats.errors,
      lastExecution: stats.lastExecution,
    },
  }).catch((err) => {
    console.error('[STATS] Erro ao persistir stats:', err.message);
  });
}
