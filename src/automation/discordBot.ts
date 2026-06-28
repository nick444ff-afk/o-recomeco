import { addLog } from '../services/logService';
import { incrementStat, setStat, getStats, resetStats } from '../services/statsService';
import { getSettings } from '../services/settingsService';
import { BotConfig } from '../types';

const BUTTON_TREE = {
  Mobile: {
    "1x1": ["Gel normal", "Gel inf"],
    "2x2": ["Normal", "Full ump xm8"],
    "3x3": ["Normal", "Full ump xm8"],
    "4x4": ["Normal", "Full ump xm8"]
  },
  Emulador: {
    "1x1": ["Gel normal", "Gel inf"],
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

// Estado global dos bots
const botInstances: Map<string, {
  client: any;
  isRunning: boolean;
  loopTimeout: NodeJS.Timeout | null;
}> = new Map();

// Conjunto para controle de mensagens enviadas por canal (evita spam)
const sentMessagesTracker: Map<string, Set<string>> = new Map();
// Controle de temporizadores de cancelamento por canal
const cancelTimers: Map<string, NodeJS.Timeout> = new Map();

// Importação dinâmica do discord.js-selfbot-v13
let DiscordClient: any = null;

async function getDiscordClient() {
  if (!DiscordClient) {
    try {
      const discord = require('discord.js-selfbot-v13');
      DiscordClient = discord.Client;
    } catch (err) {
      console.error('[DISCORD] discord.js-selfbot-v13 não encontrado. Instale com: npm install discord.js-selfbot-v13');
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
      return { success: false, message: 'Token não configurado. Salve a configuração primeiro.' };
    }

    if (isBotRunning(botId)) {
      return { success: false, message: 'Bot já está em execução.' };
    }

    const Client = await getDiscordClient();
    const client = new Client();

    addLog(botId, { type: 'info', message: 'Conectando ao Discord...' });

    await client.login(config.token);

    addLog(botId, { type: 'success', message: `Logado como: ${client.user?.tag || 'Desconhecido'}` });

    const instance = {
      client,
      isRunning: true,
      loopTimeout: null as NodeJS.Timeout | null,
    };

    botInstances.set(botId, instance);

    // Listeners para monitoramento em tempo real (Lógica ofc_modificado)
    client.on('messageCreate', async (msg: any) => {
      if (!instance.isRunning) return;
      const conf = await getSettings(botId);
      handleMatchInteractions(botId, msg, conf);
    });

    client.on('messageUpdate', async (_oldMsg: any, newMsg: any) => {
      if (!instance.isRunning) return;
      const conf = await getSettings(botId);
      handleMatchInteractions(botId, newMsg, conf);
    });

    client.on('threadCreate', async (thread: any) => {
      if (!instance.isRunning) return;
      if (thread.joinable) await thread.join();
      const conf = await getSettings(botId);
      // Forçar uma verificação no novo tópico
      setTimeout(async () => {
        try {
          const msgs = await thread.messages.fetch({ limit: 5 });
          for (const [, msg] of msgs) {
            handleMatchInteractions(botId, msg, conf);
          }
        } catch (e) {}
      }, 2000);
    });
    
    // Iniciar loop de automação
    runAutomationLoop(botId, config);

    return { success: true, message: `Bot iniciado com sucesso como ${client.user?.tag}` };
  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro ao iniciar: ${err.message}` });
    return { success: false, message: `Erro ao conectar: ${err.message}` };
  }
}

export async function stopBot(botId: string): Promise<{ success: boolean; message: string }> {
  const instance = botInstances.get(botId);

  if (!instance || !instance.isRunning) {
    return { success: false, message: 'Bot não está em execução.' };
  }

  instance.isRunning = false;

  if (instance.loopTimeout) {
    clearTimeout(instance.loopTimeout);
    instance.loopTimeout = null;
  }

  try {
    instance.client.destroy();
  } catch (err: any) {
    console.error(`[DISCORD] Erro ao destruir client ${botId}:`, err.message);
  }

  botInstances.delete(botId);
  sentMessagesTracker.delete(botId);

  addLog(botId, { type: 'warn', message: 'Bot desligado pelo usuário.' });

  return { success: true, message: 'Bot desligado com sucesso.' };
}

// ═══════════════════════════════════════════════════════════════
// LOOP PRINCIPAL DA AUTOMAÇÃO
// ═══════════════════════════════════════════════════════════════

async function runAutomationLoop(botId: string, initialConfig: BotConfig): Promise<void> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return;

  try {
    // Recarregar configuração a cada ciclo (permite alteração em tempo real)
    const config = await getSettings(botId);
    const client = instance.client;

    if (!instance.isRunning) return;

    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    addLog(botId, { type: 'info', message: `Ciclo iniciado. Categorias: [${config.categories.join(', ')}] | Modos: [${config.modes.join(', ')}]` });

    // Percorrer servidores
    const guilds = client.guilds.cache;
    let totalServers = 0;
    let totalMessages = 0;
    let totalButtons = 0;
    let totalMsgSent = 0;

    for (const [, guild] of guilds) {
      if (!instance.isRunning) break;

      totalServers++;
      let cliquesNoServidor = 0;

      // Para cada combinação de modo + categoria
      for (const modo of config.modes) {
        if (!instance.isRunning) break;

        const formatSearch = modo.replace('v', 'x').toLowerCase();

        for (const categoria of config.categories) {
          if (!instance.isRunning) break;

          // Buscar canais que correspondem ao formato + categoria
          const canais = guild.channels.cache.filter((c: any) => {
            if (c.type !== 'GUILD_TEXT') return false;
            const nome = c.name.toLowerCase();
            return nome.includes(formatSearch) && nome.includes(categoria.toLowerCase());
          });

          for (const [, channel] of canais) {
            if (!instance.isRunning) break;

            try {
              const msgs = await (channel as any).messages.fetch({ limit: 10 });
              totalMessages += msgs.size;

              for (const [, msg] of msgs) {
                if (!instance.isRunning) break;
                if (!msg.components?.length) continue;

                // Nova lógica de clique baseada em etapas
                const currentCategory = categoria;
                const currentMode = modo.replace('v', 'x');

                const categoryData = (BUTTON_TREE as any)[currentCategory];
                if (categoryData && categoryData[currentMode]) {
                  const optionsToClick = categoryData[currentMode];

                  let currentMsg = msg;

                  for (const option of optionsToClick) {
                    if (!instance.isRunning) break;

                    // Recarregar a mensagem e os componentes após cada clique
                    currentMsg = await (channel as any).messages.fetch(currentMsg.id, { force: true });
                    if (!currentMsg || !currentMsg.components?.length) break;

                    let foundAndClicked = false;
                    for (const row of currentMsg.components) {
                      for (const button of row.components) {
                        if (!button.customId) continue;
                        const label = (button.label || '').toLowerCase();
                        const customId = button.customId.toLowerCase();

                        const forbiddenButtons = [
                          'sair da fila', 'leave queue', 'leave player', 'cancelar', 'fechar', 'finalizar', 'recusar', 'sair'
                        ];

                        if (forbiddenButtons.some(forbidden => label.includes(forbidden) || customId.includes(forbidden))) {
                          continue;
                        }

                        if (label.includes(option.toLowerCase()) || customId.includes(option.toLowerCase())) {
                          try {
                            await currentMsg.clickButton(button.customId);
                            totalButtons++;
                            cliquesNoServidor++;
                            incrementStat(botId, 'buttonsClicked');
                            incrementStat(botId, 'entradas');

                            const guildName = guild.name || 'Servidor Desconhecido';
                            const channelName = (channel as any).name || 'Canal Desconhecido';
                            const buttonLabel = button.label || 'Sem Label';
                            
                            addLog(botId, {
                              type: 'success',
                              message: `[${guildName}] #${channelName} -> Botão: ${buttonLabel} (${button.customId})`,
                              server: guildName,
                              channel: channelName,
                            });

                            await sleep(1500);
                            foundAndClicked = true;
                            break;
                          } catch (err: any) {
                            incrementStat(botId, 'errors');
                          }
                        }
                      }
                      if (foundAndClicked) break;
                    }
                    if (cliquesNoServidor >= 5) break;
                  }
                  if (cliquesNoServidor >= 5) break;
                }
                if (cliquesNoServidor >= 5) break;
              }

              // Enviar mensagem automática se configurada
              if (config.message && config.message.trim() !== '') {
                try {
                  await (channel as any).send(config.message);
                  totalMsgSent++;
                  incrementStat(botId, 'messagesSent');

                  addLog(botId, {
                    type: 'success',
                    message: `[${guild.name}] #${(channel as any).name} -> Mensagem automática enviada`,
                    server: guild.name,
                    channel: (channel as any).name,
                  });
                } catch (err: any) {}
              }
            } catch (err: any) {
              incrementStat(botId, 'errors');
            }
          }
        }
      }
    }

    incrementStat(botId, 'serversProcessed', totalServers);
    incrementStat(botId, 'messagesProcessed', totalMessages);

    addLog(botId, {
      type: 'info',
      message: `Ciclo finalizado. Servidores: ${totalServers} | Botões: ${totalButtons} | Mensagens: ${totalMsgSent}`,
    });

    // Monitorar canais de partida (aguardando/partida/fila)
    monitorMatchChannels(botId, client, config);

  } catch (err: any) {
    incrementStat(botId, 'errors');
    addLog(botId, { type: 'error', message: `Erro no ciclo: ${err.message}` });
  }

  // Agendar próximo ciclo
  if (instance && instance.isRunning) {
    const config = await getSettings(botId);
    const intervalMs = (config.interval || 12) * 1000;
    instance.loopTimeout = setTimeout(() => runAutomationLoop(botId, config), intervalMs);
  }
}

// ═══════════════════════════════════════════════════════════════
// MONITORAMENTO DE CANAIS DE PARTIDA (REAL-TIME & PERIODIC)
// ═══════════════════════════════════════════════════════════════

async function handleMatchInteractions(botId: string, msg: any, config: BotConfig) {
  const channel = msg.channel;
  if (!channel || !channel.name) return;

  const keywords = ['aguardando', 'partida', 'fila', 'aguardado', 'aguardo', 'jogando'];
  const channelName = channel.name.toLowerCase();

  if (!keywords.some(kw => channelName.includes(kw))) return;

  const guildName = channel.guild?.name || 'Servidor Desconhecido';

  // 1. Lógica de Mensagem Automática (Baseada no ofc_modificado)
  if (config.message && config.message.trim() !== '') {
    if (!sentMessagesTracker.has(botId)) {
      sentMessagesTracker.set(botId, new Set());
    }
    const sentSet = sentMessagesTracker.get(botId)!;

    if (!sentSet.has(channel.id)) {
      try {
        await channel.send(config.message);
        sentSet.add(channel.id);
        incrementStat(botId, 'messagesSent');
        addLog(botId, {
          type: 'success',
          message: `[${guildName}] #${channel.name} -> Mensagem automática enviada`,
          server: guildName,
          channel: channel.name,
        });

        // Configurar temporizador de 3 minutos para clicar em "Cancelar"
        if (!cancelTimers.has(channel.id)) {
          const timer = setTimeout(async () => {
            try {
              // Buscar a mensagem mais recente com componentes no canal
              const recentMsgs = await channel.messages.fetch({ limit: 10 });
              const msgToCancel = recentMsgs.find((m: any) => m.components?.length > 0);
              
              if (msgToCancel) {
                for (const row of msgToCancel.components) {
                  for (const button of row.components) {
                    const label = (button.label || '').toLowerCase();
                    const customId = (button.customId || '').toLowerCase();
                    
                    if (label.includes('cancelar') || customId.includes('cancelar')) {
                      await msgToCancel.clickButton(button.customId);
                      addLog(botId, {
                        type: 'warn',
                        message: `[${guildName}] #${channel.name} -> Auto-cancelamento após 3 minutos executado`,
                        server: guildName,
                        channel: channel.name,
                      });
                      break;
                    }
                  }
                }
              }
            } catch (err) {}
            cancelTimers.delete(channel.id);
          }, 3 * 60 * 1000);
          
          cancelTimers.set(channel.id, timer);
        }
      } catch (err: any) {
        try { await channel.send(config.message); } catch (e) {}
      }
    }
  }

  // 2. Lógica de Cliques em Botões (Baseada no ofc_modificado)
  if (msg.components?.length) {
    for (const row of msg.components) {
      for (const button of row.components) {
        if (!button.customId) continue;
        
        const label = (button.label || '').toLowerCase();
        const customId = button.customId.toLowerCase();

        const forbiddenButtons = [
          'sair da fila', 'leave queue', 'leave player', 'cancelar', 'fechar', 'finalizar', 'recusar', 'sair'
        ];

        if (forbiddenButtons.some(forbidden => label.includes(forbidden) || customId.includes(forbidden))) {
          continue;
        }

        try {
          await msg.clickButton(button.customId);
          incrementStat(botId, 'buttonsClicked');
          const buttonLabel = button.label || 'Sem Label';
          
          addLog(botId, {
            type: 'success',
            message: `[${guildName}] #${channel.name} -> Botão: ${buttonLabel} (${button.customId})`,
            server: guildName,
            channel: channel.name,
          });
          return;
        } catch (err: any) {}
      }
    }
  }
}

async function monitorMatchChannels(botId: string, client: any, config: BotConfig): Promise<void> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return;

  const keywords = ['aguardando', 'partida', 'fila', 'aguardado', 'aguardo', 'jogando'];

  const matchChannels = client.channels.cache.filter((channel: any) =>
    channel.guild &&
    (channel.type === 'GUILD_TEXT' || channel.type === 'GUILD_PUBLIC_THREAD' || channel.type === 'GUILD_PRIVATE_THREAD') &&
    keywords.some(kw => channel.name?.toLowerCase().includes(kw)) &&
    channel.viewable
  );

  for (const [, channel] of matchChannels) {
    if (!instance.isRunning) break;
    try {
      if (channel.isThread() && !channel.joined && channel.joinable) {
        await channel.join();
      }

      const msgs = await (channel as any).messages.fetch({ limit: 5 });
      for (const [, msg] of msgs) {
        await handleMatchInteractions(botId, msg, config);
      }
    } catch (err) {}
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
