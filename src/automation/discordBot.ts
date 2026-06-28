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
  addLog(botId, { type: 'warn', message: 'Bot desligado.' });
  return { success: true, message: 'Bot desligado.' };
}

async function runAutomationLoop(botId: string, initialConfig: BotConfig): Promise<void> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return;

  try {
    const config = await getSettings(botId);
    const client = instance.client;

    // Otimização: Executar atualizações de status em paralelo sem bloquear o loop
    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    const guilds = client.guilds.cache;
    
    // Processar cada guild uma por uma para garantir a ordem
    for (const [, guild] of guilds) {
      if (!instance.isRunning) break;
      const guildName = guild.name || 'Servidor';
      let cliquesNoServidor = 0;
      let canaisEncontrados: any[] = [];

      // 1. Escanear todos os canais que batem com a configuração
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
          
          for (const [, channel] of matchingChannels) {
            canaisEncontrados.push({ channel, modo, categoria });
          }
        }
      }

      // 2. Dar até 5 cliques, um por um, nos canais encontrados
      for (const item of canaisEncontrados) {
        if (!instance.isRunning || cliquesNoServidor >= 5) break;
        const { channel, modo, categoria } = item;

        try {
          const msgs = await (channel as any).messages.fetch({ limit: 10 });
          for (const [, msg] of msgs) {
            if (!instance.isRunning || cliquesNoServidor >= 5) break;
            if (!msg.components?.length) continue;

            const categoryData = (BUTTON_TREE as any)[categoria];
            if (categoryData && categoryData[modo.replace('v', 'x')]) {
              const optionsToClick = categoryData[modo.replace('v', 'x')];
              
              // Fetch atualizado para garantir componentes
              const currentMsg = await (channel as any).messages.fetch(msg.id, { force: true });
              if (!currentMsg || !currentMsg.components?.length) continue;

              const validButtons = [];
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
                try {
                  const randomButton = validButtons[Math.floor(Math.random() * validButtons.length)];
                  await currentMsg.clickButton(randomButton.customId);
                  cliquesNoServidor++;
                  incrementStat(botId, 'buttonsClicked');
                  addLog(botId, { type: 'success', message: `Clique: "${channel.name}" em "${guildName}"` });
                  await sleep(500); // Delay entre cliques para estabilidade
                } catch (e: any) {
                  if (!e.message.includes('Unknown Message') && !e.message.includes('Interaction failed')) {
                    addLog(botId, { type: 'error', message: `Erro no clique (${guildName}): ${e.message}` });
                  }
                }
              }
            }
          }
        } catch (e: any) {
          // Silencioso para erros de fetch
        }
      }

      // 3. Enviar a mensagem se configurada (após os cliques ou se não houver cliques)
      if (config.message && config.message.trim() !== '' && instance.isRunning) {
        // Enviar no primeiro canal válido encontrado para este servidor
        if (canaisEncontrados.length > 0) {
          const targetChannel = canaisEncontrados[0].channel;
          try {
            await targetChannel.send(config.message);
            incrementStat(botId, 'messagesSent');
            addLog(botId, { type: 'warn', message: `Mensagem enviada em "${targetChannel.name}" de "${guildName}"` });
          } catch (e) {}
        }
      }
      
      // Otimização: Assim que terminar o servidor (por cliques ou por esgotar canais), o loop já passa para o próximo automaticamente
    }

  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro no ciclo: ${err.message}` });
  }

  if (instance && instance.isRunning) {
    const config = await getSettings(botId);
    // Otimização: Reduzir o intervalo mínimo para 2 segundos se não configurado, garantindo tempo real
    const intervalMs = Math.max((config.interval || 2) * 1000, 2000);
    instance.loopTimeout = setTimeout(() => runAutomationLoop(botId, config), intervalMs);
  }
}

async function handleGlobalMessageReaction(botId: string, msg: any) {
  const channel = msg.channel;
  if (!channel || !channel.name) return;

  // Onipresente: Qualquer canal que contenha as palavras-chave deve disparar
  const keywords = ['aguardando', 'partida', 'fila'];
  const channelName = channel.name.toLowerCase();
  
  if (!keywords.some(kw => channelName.includes(kw))) return;

  const guildName = channel.guild?.name || 'Servidor';
  const config = await getSettings(botId);

  if (config.message && config.message.trim() !== '') {
    if (!sentMessagesTracker.has(botId)) sentMessagesTracker.set(botId, new Set());
    const sentSet = sentMessagesTracker.get(botId)!;

    // Enviar sempre que aparecer, mas evitar spam infinito no mesmo canal em segundos
    if (!sentSet.has(channel.id)) {
      try {
        channel.send(config.message).then(() => {
          sentSet.add(channel.id);
          incrementStat(botId, 'messagesSent');
          addLog(botId, { type: 'warn', message: `[EVENTO] Mensagem enviada em "${channel.name}" de "${guildName}"` });
          
          // Limpar do tracker após 1 minuto para permitir re-envio se o canal for recriado/reutilizado
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

  // Clicar em botões se houver, mesmo em eventos globais
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
