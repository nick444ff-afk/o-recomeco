import { addLog } from '../services/logService';
import { incrementStat, setStat, getStats } from '../services/statsService';
import { getSettings } from '../services/settingsService';
import { BotConfig } from '../types';

const botInstances: Map<string, {
  client: any;
  isRunning: boolean;
  loopTimeout: NodeJS.Timeout | null;
}> = new Map();

const sentMessagesTracker: Map<string, Set<string>> = new Map();
const processingChannels: Map<string, Set<string>> = new Map();

async function getDiscordClient() {
  try {
    const discord = require('discord.js-selfbot-v13');
    return discord.Client;
  } catch (err) {
    throw err;
  }
}

export function isBotRunning(botId: string): boolean {
  const instance = botInstances.get(botId);
  return instance?.isRunning || false;
}

export async function startBot(botId: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getSettings(botId);

    if (!config.token || config.token.trim() === '') {
      return { success: false, message: 'Token não configurado.' };
    }

    if (isBotRunning(botId)) {
      return { success: false, message: 'Bot já está em execução.' };
    }

    const Client = await getDiscordClient();
    const client = new Client({
        checkUpdate: false
    });

    await client.login(config.token);

    addLog(botId, { type: 'info', message: `Logado com "${client.user?.username || 'Desconhecido'}"` });

    const instance = {
      client,
      isRunning: true,
      loopTimeout: null as NodeJS.Timeout | null,
    };

    botInstances.set(botId, instance);

    // Lógica de Eventos (Extraída do ZIP e adaptada)
    client.on('messageCreate', async (msg: any) => {
      if (!instance.isRunning) return;
      handleAutoLogic(botId, msg, config);
    });

    client.on('messageUpdate', async (_oldMsg: any, newMsg: any) => {
      if (!instance.isRunning) return;
      handleAutoLogic(botId, newMsg, config);
    });

    client.on('threadCreate', async (thread: any) => {
      if (!instance.isRunning) return;
      if (thread.joinable) await thread.join();
      
      setTimeout(async () => {
        try {
          const msgs = await thread.messages.fetch({ limit: 5 });
          for (const [, msg] of msgs) {
            handleAutoLogic(botId, msg, config);
          }
        } catch (e) {}
      }, 500);
    });
    
    runAutomationLoop(botId);

    return { success: true, message: `Logado como ${client.user?.username}` };
  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro ao logar: ${err.message}` });
    return { success: false, message: `Erro: ${err.message}` };
  }
}

export async function stopBot(botId: string): Promise<{ success: boolean; message: string }> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return { success: false, message: 'Bot parado.' };
  instance.isRunning = false;
  if (instance.loopTimeout) clearTimeout(instance.loopTimeout);
  try { instance.client.destroy(); } catch (e) {}
  botInstances.delete(botId);
  sentMessagesTracker.delete(botId);
  processingChannels.delete(botId);
  addLog(botId, { type: 'warn', message: 'Bot desligado.' });
  return { success: true, message: 'Bot desligado.' };
}

// Função auxiliar para limpar nomes (Extraída do ZIP)
const cleanName = (str: string) =>
    str.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w-]/g, "")
    .toLowerCase();

async function runAutomationLoop(botId: string): Promise<void> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return;

  try {
    const config = await getSettings(botId);
    const client = instance.client;

    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    const tipoMap: Record<string, string> = { 'Tático': 'tatico', 'Mobile': 'mob', 'Emulador': 'emu', 'Misto': 'mis' };
    
    for (const [, guild] of client.guilds.cache) {
      if (!instance.isRunning) break;

      for (const modo of config.modes) {
        for (const categoria of config.categories) {
          const tipo = tipoMap[categoria];
          if (!tipo) continue;

          const variations = [modo.toLowerCase(), modo.replace('v', 'x').toLowerCase()];
          
          const canais = guild.channels.cache.filter((c: any) => {
            if (c.type !== 'GUILD_TEXT') return false;
            const name = cleanName(c.name);
            return name.includes(tipo) && variations.some(v => name.includes(v));
          });

          for (const [, channel] of canais) {
            if (!instance.isRunning) break;
            
            try {
              const msgs = await (channel as any).messages.fetch({ limit: 5 });
              for (const [, msg] of msgs) {
                await handleAutoLogic(botId, msg, config);
              }
            } catch (e) {}
          }
        }
      }
    }

  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro no ciclo: ${err.message}` });
  }

  if (instance && instance.isRunning) {
    const config = await getSettings(botId);
    const intervalMs = Math.max((config.interval || 10) * 1000, 5000);
    instance.loopTimeout = setTimeout(() => runAutomationLoop(botId), intervalMs);
  }
}

async function handleAutoLogic(botId: string, msg: any, config: BotConfig) {
    const instance = botInstances.get(botId);
    if (!instance || !instance.isRunning) return;

    const channel = msg.channel;
    if (!channel || !channel.name) return;

    // 1. Lógica de Envio Automático de Mensagens (Extraída do ZIP)
    if (config.message && config.message.trim() !== '') {
        if (!sentMessagesTracker.has(botId)) sentMessagesTracker.set(botId, new Set());
        const sentSet = sentMessagesTracker.get(botId)!;

        const keywords = ['aguardando', 'partida', 'fila'];
        const channelName = channel.name.toLowerCase();
        
        if (keywords.some(kw => channelName.includes(kw)) && !sentSet.has(channel.id)) {
            try {
                await channel.send(config.message);
                sentSet.add(channel.id);
                incrementStat(botId, 'messagesSent');
                addLog(botId, { type: 'success', message: `Mensagem enviada em "${channel.name}"` });
                setTimeout(() => sentSet.delete(channel.id), 60000);
            } catch (e) {}
        }
    }

    // 2. Lógica de Cliques em Botões (Extraída do ZIP e adaptada aos requisitos)
    if (!msg.components || msg.components.length === 0) return;

    if (!processingChannels.has(botId)) processingChannels.set(botId, new Set());
    const procSet = processingChannels.get(botId)!;
    if (procSet.has(msg.id)) return;

    const allowedButtons = ["gel normal", "gel inf", "gelo normal", "gelo infinito"];
    const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar'];

    for (const row of msg.components) {
        for (const button of row.components) {
            const label = (button.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const customId = (button.customId || '').toLowerCase();

            // Prioridade para os botões solicitados pelo usuário
            if (allowedButtons.some(b => label.includes(b) || customId.includes(b))) {
                try {
                    procSet.add(msg.id);
                    await msg.clickButton(button.customId);
                    incrementStat(botId, 'buttonsClicked');
                    addLog(botId, { type: 'success', message: `Botão "${button.label}" clicado em "${channel.name}"` });
                    return;
                } catch (e) {}
            }

            // Lógica genérica de confirmação (Extraída do ZIP: clica se não for proibido)
            if (!forbidden.some(f => label.includes(f) || customId.includes(f))) {
                // Se chegamos aqui, é um botão de ação que não é de cancelamento
                // Mas vamos focar nos permitidos primeiro. Se o usuário quiser manter a lógica do ZIP:
                try {
                    procSet.add(msg.id);
                    await msg.clickButton(button.customId);
                    incrementStat(botId, 'buttonsClicked');
                    addLog(botId, { type: 'success', message: `Botão de ação "${button.label}" clicado em "${channel.name}"` });
                    return;
                } catch (e) {}
            }
        }
    }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
