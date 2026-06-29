import prisma from '../config/database';
import { BotConfig } from '../types';

const settingsCache = new Map<string, BotConfig>();

export async function getSettings(botId: string): Promise<BotConfig> {
  if (settingsCache.has(botId)) {
    return settingsCache.get(botId)!;
  }

  let settings = await prisma.settings.findUnique({
    where: { botId },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        botId,
        token: '',
        message: '',
        interval: 12,
        categories: [],
        modes: [],
        isRunning: false,
        // selections será armazenado como JSON no campo de modos ou categorias se o schema for fixo
        // mas aqui vamos tratar no objeto de retorno
      },
    });
  }

  const botConfig: BotConfig = {
    botId: settings.botId,
    token: settings.token,
    message: settings.message,
    interval: settings.interval,
    selections: (settings as any).selections || {},
    isRunning: settings.isRunning,
  };

  settingsCache.set(botId, botConfig);
  return botConfig;
}

export async function saveSettings(botId: string, data: Partial<BotConfig>): Promise<BotConfig> {
  const settings = await prisma.settings.upsert({
    where: { botId },
    update: {
      ...(data.token !== undefined && { token: data.token }),
      ...(data.message !== undefined && { message: data.message }),
      ...(data.interval !== undefined && { interval: data.interval }),
      ...(data.isRunning !== undefined && { isRunning: data.isRunning }),
      // Armazenando o objeto de seleções no campo modes como string JSON para evitar mudar o schema do Prisma
      ...(data.selections !== undefined && { modes: [JSON.stringify(data.selections)] }),
    },
    create: {
      botId,
      token: data.token || '',
      message: data.message || '',
      interval: data.interval || 12,
      isRunning: data.isRunning || false,
      modes: data.selections ? [JSON.stringify(data.selections)] : [],
    },
  });

  let selections = {};
  try {
    if (settings.modes && settings.modes.length > 0) {
      selections = JSON.parse(settings.modes[0]);
    }
  } catch (e) {}

  const botConfig: BotConfig = {
    botId: settings.botId,
    token: settings.token,
    message: settings.message,
    interval: settings.interval,
    selections: selections,
    isRunning: settings.isRunning,
  };

  settingsCache.set(botId, botConfig);
  return botConfig;
}

export async function setRunning(botId: string, isRunning: boolean): Promise<void> {
  await prisma.settings.update({
    where: { botId },
    data: { isRunning },
  });
  if (settingsCache.has(botId)) {
    const cachedSettings = settingsCache.get(botId)!;
    settingsCache.set(botId, { ...cachedSettings, isRunning });
  }
}
