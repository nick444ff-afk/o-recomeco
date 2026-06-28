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
      },
    });
  }

  const botConfig: BotConfig = {
    botId: settings.botId,
    token: settings.token,
    message: settings.message,
    interval: settings.interval,
    categories: settings.categories,
    modes: settings.modes,
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
      ...(data.categories !== undefined && { categories: data.categories }),
      ...(data.modes !== undefined && { modes: data.modes }),
      ...(data.isRunning !== undefined && { isRunning: data.isRunning }),
    },
    create: {
      botId,
      token: data.token || '',
      message: data.message || '',
      interval: data.interval || 12,
      categories: data.categories || [],
      modes: data.modes || [],
      isRunning: data.isRunning || false,
    },
  });

  const botConfig: BotConfig = {
    botId: settings.botId,
    token: settings.token,
    message: settings.message,
    interval: settings.interval,
    categories: settings.categories,
    modes: settings.modes,
    isRunning: settings.isRunning,
  };

  settingsCache.set(botId, botConfig); // Update cache after saving
  return botConfig;
}

export async function setRunning(botId: string, isRunning: boolean): Promise<void> {
  await prisma.settings.upsert({
    where: { botId },
    update: { isRunning },
    create: {
      botId,
      token: '',
      message: '',
      interval: 12,
      categories: [],
      modes: [],
      isRunning,
    },
  });
  if (settingsCache.has(botId)) {
    const cachedSettings = settingsCache.get(botId)!;
    settingsCache.set(botId, { ...cachedSettings, isRunning }); // Update cache
  }
}
