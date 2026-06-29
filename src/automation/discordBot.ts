import { addLog } from '../services/logService';
import { incrementStat, setStat, getStats, resetStats } from '../services/statsService';
import { getSettings } from '../services/settingsService';
import { BotConfig } from '../types';

const BUTTON_TREE = {
  Mobile: {
    "1x1": [
      "Gelo normal",
      "Gel normal",
      "Gel inf",
      "Gelo infinito",
      "Gel infinito",
      "Normal",
      "Infinito"
    ],
    "2x2": ["Normal", "Full ump xm8"],
    "3x3": ["Normal", "Full ump xm8"],
    "4x4": ["Normal", "Full ump xm8"]
  },
  Emulador: {
    "1x1": [
      "Gelo normal",
      "Gel normal",
      "Gel inf",
      "Gelo infinito",
      "Gel infinito",
      "Normal",
      "Infinito"
    ],
    "2x2": ["Normal", "Full ump xm8"],
    "3x3": ["Normal", "Full ump xm8"],
    "4x4": ["Normal", "Full ump xm8"]
  },
  Misto: {
    "2x2": ["1 Emu"],
    "3x3": ["1 Emu", "2 Emu"],
    "4x4": ["1 Emu", "2 Emu", "3 Emu"]
  },
  Tático: {
    "1x1": ["Mobile", "Emulador"],
    "2x2": ["Mobile", "Emulador", "Misto"],
    "3x3": ["Mobile", "Emulador", "Misto"],
    "4x4": ["Mobile", "Emulador", "Misto"]
  }
};

const botInstances: Map<string, {
  client: any;
  isRunning: boolean;
  loopTimeout: NodeJS.Timeout | null;
}> = new Map();

const sentMessagesTracker: Map<string, Set<string>> = new Map();
const cancelTimers: Map<string, NodeJS.Timeout> = new Map();

// 1. Criar cache global
const cachedTargets: Map<string, Map<string, {
  channelId: string;
  messageId: string;
  validButtons: any[];
  modo: string;
  categoria: string;
}>> = new Map();

let DiscordClient: any = null;

async function getDiscordClient() {
  if (!DiscordClient) {
    try {
      const discord = require('discord.js-selfbot-v13');
      DiscordClient = discord.Client;
    } catch (err) {
      throw err;
    }
  }
  return DiscordClient;
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
    const client = new Client();

    await client.login(config.token);

    addLog(botId, { type: 'info', message: `Logado com "${client.user?.username || 'Desconhecido'}"` });

    const instance = {
      client,
      isRunning: true,
      loopTimeout: null as NodeJS.Timeout | null,
    };

    botInstances.set(botId, instance);

    client.on('messageCreate', async (msg: any) => {
      if (!instance.isRunning) return;
      handleGlobalMessageReaction(botId, msg);
    });

    client.on('messageUpdate', async (_oldMsg: any, newMsg: any) => {
      if (!instance.isRunning) return;
      handleGlobalMessageReaction(botId, newMsg);
    });

    client.on('threadCreate', async (thread: any) => {
      if (!instance.isRunning) return;
      if (thread.joinable) await thread.join();
      
      setTimeout(async () => {
        try {
          const msgs = await thread.messages.fetch({ limit: 10 });
          for (const [, msg] of msgs) {
            handleGlobalMessageReaction(botId, msg);
          }
        } catch (e) {}
      }, 300);
    });
    
    runAutomationLoop(botId, config);

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
  cachedTargets.delete(botId); // Limpar cache ao parar o bot
  addLog(botId, { type: 'warn', message: 'Bot desligado.' });
  return { success: true, message: 'Bot desligado.' };
}

async function runAutomationLoop(botId: string, initialConfig: BotConfig): Promise<void> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return;

  try {
    const config = await getSettings(botId);
    const client = instance.client;

    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    const guilds = client.guilds.cache;
    
    if (!cachedTargets.has(botId)) {
      cachedTargets.set(botId, new Map());
    }
    const botCache = cachedTargets.get(botId)!;

    for (const [, guild] of guilds) {
      if (!instance.isRunning) break;
      const guildName = guild.name || 'Servidor';
      let cliquesNoServidor = 0;

      // 3. Verificar se existir usar cache diretamente
      if (botCache.has(guild.id)) {
        addLog(botId, { type: 'info', message: `[CACHE] Usando cache do servidor ${guildName}` });
        const cached = botCache.get(guild.id)!;
        
        try {
          const channel = await client.channels.fetch(cached.channelId);
          if (!channel) throw new Error('Canal não existe');

          const msg = await (channel as any).messages.fetch(cached.messageId, { force: true });
          if (!msg || !msg.components?.length) throw new Error('Mensagem ou botões sumiram');

          if (cached.validButtons.length > 0) {
            const randomButton = cached.validButtons[Math.floor(Math.random() * cached.validButtons.length)];
            await msg.clickButton(randomButton.customId);
            addLog(botId, { type: 'success', message: `[CLICK] Botão clicado via cache: "${channel.name}" em "${guildName}"` });
            cliquesNoServidor++;
            incrementStat(botId, 'buttonsClicked');
            await sleep(500);
          } else {
            throw new Error('validButtons ficou vazio');
          }
        } catch (e: any) {
          // 4. Fallback: remover cache e refazer scan
          addLog(botId, { type: 'warn', message: `[RECACHE] Cache inválido, reescanando servidor ${guildName}: ${e.message}` });
          botCache.delete(guild.id);
          // O scan será feito na próxima iteração ou logo abaixo se não dermos continue
        }

        // Se o cache funcionou ou falhou e foi deletado, processamos a mensagem e pulamos para o próximo servidor
        if (config.message && config.message.trim() !== '' && instance.isRunning) {
          try {
            const channel = await client.channels.fetch(cached.channelId);
            if (channel) {
              await (channel as any).send(config.message);
              incrementStat(botId, 'messagesSent');
              addLog(botId, { type: 'warn', message: `Mensagem enviada via cache em "${(channel as any).name}" de "${guildName}"` });
            }
          } catch (e) {}
        }
        continue;
      }

      // 2. Fazer scan apenas uma vez (quando não há cache)
      addLog(botId, { type: 'info', message: `[SCAN] Guild encontrada: ${guildName}` });
      let canaisEncontrados: any[] = [];

      // 5. Respeitar apenas o modo selecionado
      for (const modo of config.modes) {
        const variations = [
          modo.toLowerCase(),
          modo.replace('v', 'x').toLowerCase()
        ];
        for (const categoria of config.categories) {
          const matchingChannels = guild.channels.cache.filter((c: any) => {
            if (c.type !== 'GUILD_TEXT' && c.type !== 'GUILD_NEWS') return false;
            const nome = c.name.toLowerCase();
            return variations.some(v => nome.includes(v)) &&
                   nome.includes(categoria.toLowerCase());
          });
          
          for (const [, c] of matchingChannels) {
            addLog(botId, { type: 'info', message: `[SCAN] Canal encontrado: ${c.name}` });
            canaisEncontrados.push({ channel: c, modo, categoria });
          }
        }
      }

      for (const item of canaisEncontrados) {
        if (!instance.isRunning || cliquesNoServidor >= 5) break;
        const { channel, modo, categoria } = item;

        try {
          const msgs = await (channel as any).messages.fetch({ limit: 10 });
          addLog(botId, { type: 'info', message: `[SCAN] Mensagens carregadas: ${msgs.size} no canal ${channel.name}` });
          
          for (const [, msg] of msgs) {
            if (!instance.isRunning || cliquesNoServidor >= 5) break;
            if (!msg.components?.length) continue;

            const categoryData = (BUTTON_TREE as any)[categoria];
            if (categoryData && categoryData[modo.replace('v', 'x')]) {
              const optionsToClick = categoryData[modo.replace('v', 'x')];
              
              const currentMsg = await (channel as any).messages.fetch(msg.id, { force: true });
              if (!currentMsg || !currentMsg.components?.length) continue;

              const validButtons: any[] = [];
              for (const row of currentMsg.components) {
                for (const button of row.components) {
                  if (!button.customId) continue;
                  
                  const rawLabel = button.label || '';
                  const label = rawLabel
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim();
                  
                  const customId = button.customId.toLowerCase();
                  const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar', 'confirmar'];

                  if (forbidden.some(f => label.includes(f) || customId.includes(f))) continue;

                  for (const option of optionsToClick) {
                    const normalizedOption = option
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .trim();

                    if (label.includes(normalizedOption) || customId.includes(normalizedOption)) {
                      if (!validButtons.some(b => b.customId === button.customId)) {
                        validButtons.push(button);
                      }
                    }
                  }
                }
              }

              if (validButtons.length > 0) {
                // Salvar no cache
                botCache.set(guild.id, {
                  channelId: channel.id,
                  messageId: currentMsg.id,
                  validButtons,
                  modo,
                  categoria
                });
                addLog(botId, { type: 'info', message: `[SCAN] Botões válidos cacheados para ${guildName}` });

                try {
                  const randomButton = validButtons[Math.floor(Math.random() * validButtons.length)];
                  await currentMsg.clickButton(randomButton.customId);
                  addLog(botId, { type: 'success', message: `[SUCCESS] Clique inicial executado: "${channel.name}" em "${guildName}"` });
                  cliquesNoServidor++;
                  incrementStat(botId, 'buttonsClicked');
                  await sleep(500);
                } catch (error) {
                  addLog(botId, { type: 'error', message: `[ERROR] Falha ao clicar no scan: ${String(error)}` });
                  botCache.delete(guild.id);
                }
                break; // Sai do loop de mensagens para este canal, pois já achamos e cacheamos
              }
            }
          }
          if (botCache.has(guild.id)) break; // Se já cacheou algo neste servidor, vai para o próximo
        } catch (e: any) {}
      }

      // Enviar mensagem se não estiver no cache (primeira vez)
      if (config.message && config.message.trim() !== '' && instance.isRunning) {
        if (canaisEncontrados.length > 0) {
          const targetChannel = canaisEncontrados[0].channel;
          try {
            await targetChannel.send(config.message);
            incrementStat(botId, 'messagesSent');
            addLog(botId, { type: 'warn', message: `Mensagem enviada em "${targetChannel.name}" de "${guildName}"` });
          } catch (e) {}
        }
      }
    }

  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro no ciclo: ${err.message}` });
  }

  if (instance && instance.isRunning) {
    const config = await getSettings(botId);
    const intervalMs = Math.max((config.interval || 2) * 1000, 2000);
    instance.loopTimeout = setTimeout(() => runAutomationLoop(botId, config), intervalMs);
  }
}

async function handleGlobalMessageReaction(botId: string, msg: any) {
  const channel = msg.channel;
  if (!channel || !channel.name) return;

  const keywords = ['aguardando', 'partida', 'fila'];
  const channelName = channel.name.toLowerCase();
  
  if (!keywords.some(kw => channelName.includes(kw))) return;

  const guildName = channel.guild?.name || 'Servidor';
  const config = await getSettings(botId);

  if (config.message && config.message.trim() !== '') {
    if (!sentMessagesTracker.has(botId)) sentMessagesTracker.set(botId, new Set());
    const sentSet = sentMessagesTracker.get(botId)!;

    if (!sentSet.has(channel.id)) {
      try {
        channel.send(config.message).then(() => {
          sentSet.add(channel.id);
          incrementStat(botId, 'messagesSent');
          addLog(botId, { type: 'warn', message: `[EVENTO] Mensagem enviada em "${channel.name}" de "${guildName}"` });
          
          setTimeout(() => sentSet.delete(channel.id), 60000);
        }).catch(() => {});

        if (!cancelTimers.has(channel.id)) {
          const timer = setTimeout(async () => {
            try {
              const recentMsgs = await channel.messages.fetch({ limit: 10 });
              const msgToCancel = recentMsgs.find((m: any) => m.components?.length > 0);
              if (msgToCancel) {
                for (const row of msgToCancel.components) {
                  for (const button of row.components) {
                    const label = (button.label || '').toLowerCase();
                    const cid = (button.customId || '').toLowerCase();
                    if (label.includes('cancelar') || cid.includes('cancelar')) {
                      msgToCancel.clickButton(button.customId).catch(()=>{});
                      break;
                    }
                  }
                }
              }
            } catch (e) {}
            cancelTimers.delete(channel.id);
          }, 180000);
          cancelTimers.set(channel.id, timer);
        }
      } catch (e) {}
    }
  }

  if (msg.components?.length) {
    for (const row of msg.components) {
      for (const button of row.components) {
        if (!button.customId) continue;
        const label = (button.label || '').toLowerCase();
        const customId = button.customId.toLowerCase();
        const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar', 'confirmar'];
        if (forbidden.some(f => label.includes(f) || customId.includes(f))) continue;

        try {
          await msg.clickButton(button.customId);
          incrementStat(botId, 'buttonsClicked');
          addLog(botId, { type: 'success', message: `[EVENTO] Clique: "${channel.name}" em "${guildName}"` });
        } catch (e: any) {
          if (!e.message.includes('Unknown Message') && !e.message.includes('Interaction failed')) {
            addLog(botId, { type: 'error', message: `Erro no clique global (${guildName}): ${e.message}` });
          }
        }
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
