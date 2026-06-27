import { addLog } from '../services/logService';
import { incrementStat, setStat } from '../services/statsService';
import { getSettings } from '../services/settingsService';
import { BotConfig } from '../types';

// Estado global dos bots
const botInstances: Map<string, {
  client: any;
  isRunning: boolean;
  loopTimeout: NodeJS.Timeout | null;
}> = new Map();

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

    // Mapear categorias para busca
    const categoriaMap: Record<string, string> = {
      'Mobile': 'mob',
      'Emulador': 'emu',
      'Misto': 'misto',
      'Tático': 'tatico',
    };

    // Percorrer servidores
    const guilds = client.guilds.cache;
    let totalServers = 0;
    let totalMessages = 0;
    let totalButtons = 0;
    let totalMsgSent = 0;

    for (const [, guild] of guilds) {
      if (!instance.isRunning) break;

      totalServers++;

      // Para cada combinação de modo + categoria
      for (const modo of config.modes) {
        if (!instance.isRunning) break;

        const formatSearch = modo.replace('v', 'x').toLowerCase();

        for (const categoria of config.categories) {
          if (!instance.isRunning) break;

          const categoriaSearch = categoriaMap[categoria];
          if (!categoriaSearch) continue;

          // Buscar canais que correspondem ao formato + categoria
          const canais = guild.channels.cache.filter((c: any) => {
            if (c.type !== 'GUILD_TEXT') return false;
            const nome = c.name.toLowerCase();
            return nome.includes(formatSearch) && nome.includes(categoriaSearch);
          });

          for (const [, channel] of canais) {
            if (!instance.isRunning) break;

            try {
              const msgs = await (channel as any).messages.fetch({ limit: 10 });
              totalMessages += msgs.size;

              for (const [, msg] of msgs) {
                if (!instance.isRunning) break;
                if (!msg.components?.length) continue;

                // Percorrer componentes e clicar em botões válidos
                for (const row of msg.components) {
                  for (const button of row.components) {
                    if (!instance.isRunning) break;
                    if (!button.customId) continue;

                    // Ignorar botões negativos
                    const label = (button.label || '').toLowerCase();
                    if (['leave_player', 'cancelar', 'fechar', 'finalizar', 'recusar', 'sair'].includes(button.customId) ||
                        ['cancelar', 'fechar', 'finalizar', 'recusar', 'sair'].includes(label)) {
                      continue;
                    }

                    // Clicar no botão
                    try {
                      await msg.clickButton(button.customId);
                      totalButtons++;
                      incrementStat(botId, 'buttonsClicked');
                      incrementStat(botId, 'entradas');

                      addLog(botId, {
                        type: 'success',
                        message: `Botão clicado: "${button.label || button.customId}" em #${(channel as any).name}`,
                        server: guild.name,
                        channel: (channel as any).name,
                      });

                      // Aguardar um pouco entre cliques
                      await sleep(1500);
                    } catch (err: any) {
                      incrementStat(botId, 'errors');
                      addLog(botId, {
                        type: 'error',
                        message: `Erro ao clicar botão: ${err.message}`,
                        server: guild.name,
                        channel: (channel as any).name,
                      });
                    }
                  }
                }
              }

              // Enviar mensagem automática se configurada
              if (config.message && config.message.trim() !== '') {
                try {
                  await (channel as any).send(config.message);
                  totalMsgSent++;
                  incrementStat(botId, 'messagesSent');

                  addLog(botId, {
                    type: 'success',
                    message: `Mensagem enviada em #${(channel as any).name}`,
                    server: guild.name,
                    channel: (channel as any).name,
                  });
                } catch (err: any) {
                  addLog(botId, {
                    type: 'error',
                    message: `Erro ao enviar mensagem: ${err.message}`,
                    server: guild.name,
                    channel: (channel as any).name,
                  });
                }
              }
            } catch (err: any) {
              incrementStat(botId, 'errors');
              addLog(botId, {
                type: 'error',
                message: `Erro ao processar canal #${(channel as any).name}: ${err.message}`,
                server: guild.name,
              });
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
    await monitorMatchChannels(botId, client, config);

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
// MONITORAMENTO DE CANAIS DE PARTIDA
// ═══════════════════════════════════════════════════════════════

async function monitorMatchChannels(botId: string, client: any, config: BotConfig): Promise<void> {
  const instance = botInstances.get(botId);
  if (!instance || !instance.isRunning) return;

  const matchChannels = client.channels.cache.filter((channel: any) =>
    channel.guild &&
    (channel.type === 'GUILD_TEXT' || channel.type === 'GUILD_PRIVATE_THREAD') &&
    (channel.name?.toLowerCase().includes('aguardando') ||
     channel.name?.toLowerCase().includes('partida') ||
     channel.name?.toLowerCase().includes('fila')) &&
    channel.viewable
  );

  for (const [, channel] of matchChannels) {
    if (!instance.isRunning) break;

    try {
      const msgs = await (channel as any).messages.fetch({ limit: 5 });

      // Enviar mensagem automática
      if (config.message && config.message.trim() !== '') {
        try {
          await (channel as any).send(config.message);
          incrementStat(botId, 'messagesSent');
          addLog(botId, {
            type: 'success',
            message: `Msg automática enviada em #${(channel as any).name}`,
            server: (channel as any).guild?.name || '?',
            channel: (channel as any).name,
          });
        } catch (err: any) {
          addLog(botId, {
            type: 'error',
            message: `Erro msg automática: ${err.message}`,
            server: (channel as any).guild?.name || '?',
            channel: (channel as any).name,
          });
        }
      }

      // Confirmar fila automaticamente
      const firstMsg = msgs.find((m: any) => m.components?.length);
      if (firstMsg) {
        for (const row of firstMsg.components) {
          let confirmed = false;
          for (const button of row.components) {
            if (confirmed) break;
            if (!button.customId) continue;
            const label = (button.label || '').toLowerCase();
            if (['cancelar', 'finalizar', 'recusar', 'fechar', 'sair'].includes(label)) continue;
            if (button.customId === 'leave_player') continue;

            try {
              await firstMsg.clickButton(button.customId);
              confirmed = true;
              incrementStat(botId, 'buttonsClicked');
              addLog(botId, {
                type: 'success',
                message: `Fila confirmada em #${(channel as any).name}: "${button.label || button.customId}"`,
                server: (channel as any).guild?.name || '?',
                channel: (channel as any).name,
              });
            } catch (err: any) {
              addLog(botId, {
                type: 'error',
                message: `Erro ao confirmar: ${err.message}`,
                channel: (channel as any).name,
              });
            }
          }
        }
      }
    } catch (err: any) {
      addLog(botId, {
        type: 'error',
        message: `Erro ao monitorar #${(channel as any).name}: ${err.message}`,
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
