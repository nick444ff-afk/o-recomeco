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
      
      // Otimização: Reduzido o delay de 2000ms para 500ms para resposta mais rápida
      setTimeout(async () => {
        try {
          // Otimização: Buscar apenas a última mensagem para ser mais rápido
          const msgs = await thread.messages.fetch({ limit: 2 });
          for (const [, msg] of msgs) {
            handleMatchInteractions(botId, msg, conf);
          }
        } catch (e) {}
      }, 500);
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
    
    // Otimização: Processar guilds em paralelo para maior velocidade
    const guildPromises = guilds.map(async (guild: any) => {
      if (!instance.isRunning) return;
      const guildName = guild.name || 'Servidor';
      let cliquesNoServidor = 0;

      for (const modo of config.modes) {
        if (!instance.isRunning) break;
        const formatSearch = modo.replace('v', 'x').toLowerCase();

        for (const categoria of config.categories) {
          if (!instance.isRunning) break;

          const canais = guild.channels.cache.filter((c: any) => {
            if (c.type !== 'GUILD_TEXT' && c.type !== 'GUILD_NEWS') return false;
            const nome = c.name.toLowerCase();
            return nome.includes(formatSearch) && nome.includes(categoria.toLowerCase());
          });

          for (const [, channel] of canais) {
            if (!instance.isRunning) break;

            try {
              const msgs = await (channel as any).messages.fetch({ limit: 3 });
              
              for (const [, msg] of msgs) {
                if (!instance.isRunning) break;
                if (!msg.components?.length) continue;

                const categoryData = (BUTTON_TREE as any)[categoria];
                if (categoryData && categoryData[modo.replace('v', 'x')]) {
                  const optionsToClick = categoryData[modo.replace('v', 'x')];
                  let currentMsg = msg;

                  for (const option of optionsToClick) {
                    if (!instance.isRunning || cliquesNoServidor >= 5) break;
                    
                    // Otimização: Evitar fetch repetido se a mensagem já tem componentes em cache
                    if (!currentMsg.components?.length) {
                       currentMsg = await (channel as any).messages.fetch(currentMsg.id, { force: true });
                    }
                    
                    if (!currentMsg || !currentMsg.components?.length) break;

                    let foundAndClicked = false;
                    for (const row of currentMsg.components) {
                      for (const button of row.components) {
                        if (!button.customId) continue;
                        const label = (button.label || '').toLowerCase();
                        const customId = button.customId.toLowerCase();
                        const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar', 'confirmar'];

                        if (forbidden.some(f => label.includes(f) || customId.includes(f))) continue;

                        if (label.includes(option.toLowerCase()) || customId.includes(option.toLowerCase())) {
                          try {
                            // Real Log: Registrar o log apenas se o clique for bem-sucedido
                            await currentMsg.clickButton(button.customId);
                            
                            cliquesNoServidor++;
                            incrementStat(botId, 'buttonsClicked');
                            addLog(botId, { 
                              type: 'success', 
                              message: `Clique: "${channel.name}" em "${guildName}"` 
                            });
                            
                            await sleep(300);
                            foundAndClicked = true;
                            break;
                          } catch (e: any) {
                            // Silencioso para não poluir logs com erros de botões expirados, mas loga erro real se necessário
                            if (!e.message.includes('Unknown Message') && !e.message.includes('Interaction failed')) {
                               addLog(botId, { type: 'error', message: `Erro no clique (${guildName}): ${e.message}` });
                            }
                          }
                        }
                      }
                      if (foundAndClicked) break;
                    }
                  }
                }
              }

              if (config.message && config.message.trim() !== '') {
                try {
                  // Real Log: Aguardar o envio ou usar .then para confirmar o log real
                  (channel as any).send(config.message).then(() => {
                    incrementStat(botId, 'messagesSent');
                    addLog(botId, { type: 'warn', message: `Mensagem enviada em "${channel.name}" de "${guildName}"` });
                  }).catch(() => {});
                } catch (e) {}
              }
            } catch (e: any) {
              addLog(botId, { type: 'error', message: `Erro no canal ${channel.name}: ${e.message}` });
            }
          }
        }
      }
    });

    // Aguardar o processamento de todas as guilds
    await Promise.all(guildPromises);

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

async function handleMatchInteractions(botId: string, msg: any, config: BotConfig) {
  const channel = msg.channel;
  if (!channel || !channel.name) return;

  const keywords = ['aguardando', 'partida', 'fila', 'aguardado', 'aguardo', 'jogando'];
  if (!keywords.some(kw => channel.name.toLowerCase().includes(kw))) return;

  const guildName = channel.guild?.name || 'Servidor';

  if (config.message && config.message.trim() !== '') {
    if (!sentMessagesTracker.has(botId)) sentMessagesTracker.set(botId, new Set());
    const sentSet = sentMessagesTracker.get(botId)!;

    if (!sentSet.has(channel.id)) {
      try {
        // Real Log: Confirmar envio antes de logar
        channel.send(config.message).then(() => {
          sentSet.add(channel.id);
          incrementStat(botId, 'messagesSent');
          addLog(botId, { type: 'warn', message: `Mensagem enviada em "${channel.name}" de "${guildName}"` });
        }).catch(() => {});

        if (!cancelTimers.has(channel.id)) {
          const timer = setTimeout(async () => {
            try {
              // Otimização: Buscar apenas as 3 últimas mensagens
              const recentMsgs = await channel.messages.fetch({ limit: 3 });
              const msgToCancel = recentMsgs.find((m: any) => m.components?.length > 0);
              if (msgToCancel) {
                for (const row of msgToCancel.components) {
                  for (const button of row.components) {
                    if ((button.label || '').toLowerCase().includes('cancelar') || (button.customId || '').toLowerCase().includes('cancelar')) {
                      // Otimização: Clicar sem bloquear
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
          // Real Log: Confirmar clique antes de logar
          await msg.clickButton(button.customId);
          incrementStat(botId, 'buttonsClicked');
          addLog(botId, { type: 'success', message: `Clique: "${channel.name}" em "${guildName}"` });
        } catch (e: any) {
          if (!e.message.includes('Unknown Message') && !e.message.includes('Interaction failed')) {
            addLog(botId, { type: 'error', message: `Erro no clique (${guildName}): ${e.message}` });
          }
        }
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
