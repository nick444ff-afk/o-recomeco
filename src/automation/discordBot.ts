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
                const currentCategory = categoria; // 'categoria' vem do loop externo
                const currentMode = modo.replace('v', 'x'); // 'modo' vem do loop externo, ajustado para corresponder a BUTTON_TREE

                const categoryData = (BUTTON_TREE as any)[currentCategory];
                if (categoryData && categoryData[currentMode]) {
                  const optionsToClick = categoryData[currentMode];

                  let currentMsg = msg; // Usar uma variável mutável para a mensagem

                  for (const option of optionsToClick) {
                    if (!instance.isRunning) break;

                    // Recarregar a mensagem e os componentes após cada clique
                    currentMsg = await (channel as any).messages.fetch(currentMsg.id, { force: true });
                    if (!currentMsg || !currentMsg.components?.length) {
                      addLog(botId, { 
                        type: 'warn', 
                        message: `[${guild.name}] #${(channel as any).name} -> Mensagem ou componentes não encontrados para opção '${option}'`,
                        server: guild.name,
                        channel: (channel as any).name
                      });
                      break; // Sai do loop de opções se a mensagem não puder ser recarregada
                    }

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
                            incrementStat(botId, 'buttonsClicked');
                            incrementStat(botId, 'entradas');

                            const guildName = guild.name || 'Servidor Desconhecido';
                            const channelName = (channel as any).name || 'Canal Desconhecido';
                            const buttonLabel = button.label || 'Sem Label';
                            const customId = button.customId || 'Sem CustomId';
                            
                            addLog(botId, {
                              type: 'success',
                              message: `[${guildName}] #${channelName} -> Botão: ${buttonLabel} (${customId})`,
                              server: guildName,
                              channel: channelName,
                            });

                            await sleep(1500);
                            foundAndClicked = true;
                            break; // Sai do loop de botões após clicar
                          } catch (err: any) {
                            incrementStat(botId, 'errors');
                            addLog(botId, {
                              type: 'error',
                              message: `[${guild.name}] #${(channel as any).name} -> Erro ao clicar '${option}': ${err.message}`,
                              server: guild.name,
                              channel: (channel as any).name,
                            });
                          }
                        }
                      }
                      if (foundAndClicked) break; // Sai do loop de linhas após clicar
                    }
                    if (!foundAndClicked) {
                      addLog(botId, { 
                        type: 'warn', 
                        message: `[${guild.name}] #${(channel as any).name} -> Opção '${option}' não encontrada`,
                        server: guild.name,
                        channel: (channel as any).name
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
                    message: `[${guild.name}] #${(channel as any).name} -> Mensagem automática enviada`,
                    server: guild.name,
                    channel: (channel as any).name,
                  });
                } catch (err: any) {
                  addLog(botId, {
                    type: 'error',
                    message: `[${guild.name}] #${(channel as any).name} -> Erro ao enviar mensagem: ${err.message}`,
                    server: guild.name,
                    channel: (channel as any).name,
                  });
                }
              }
            } catch (err: any) {
              incrementStat(botId, 'errors');
              addLog(botId, {
                type: 'error',
                message: `[${guild.name}] #${(channel as any).name} -> Erro ao processar canal: ${err.message}`,
                server: guild.name,
                channel: (channel as any).name,
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
    // Implementar regra dos 5 cliques por servidor e reinício automático
    const currentStats = await getStats(botId);
    if (currentStats.entradas >= 5) {
      addLog(botId, { type: 'info', message: 'Limite de 5 entradas por servidor atingido. Reiniciando ciclo.' });
      await resetStats(botId); // Resetar estatísticas para o próximo ciclo de servidores
    }

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
              const gName = (channel as any).guild?.name || 'Servidor Desconhecido';
              addLog(botId, {
                type: 'success',
                message: `[${gName}] #${(channel as any).name} -> Mensagem automática enviada`,
                server: gName,
                channel: (channel as any).name,
              });
        } catch (err: any) {
          const gName = (channel as any).guild?.name || 'Servidor Desconhecido';
          addLog(botId, {
            type: 'error',
            message: `[${gName}] #${(channel as any).name} -> Erro msg automática: ${err.message}`,
            server: gName,
            channel: (channel as any).name,
          });
        }
      }

      // Confirmar fila automaticamente usando a lógica de botões proibidos
      const firstMsg = msgs.find((m: any) => m.components?.length);
      if (firstMsg) {
        for (const row of firstMsg.components) {
          let confirmed = false;
          for (const button of row.components) {
            if (confirmed) break;
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
              await firstMsg.clickButton(button.customId);
              confirmed = true;
              incrementStat(botId, 'buttonsClicked');
              const guildName = (channel as any).guild?.name || 'Servidor Desconhecido';
              const channelName = (channel as any).name || 'Canal Desconhecido';
              const buttonLabel = button.label || 'Sem Label';
              const customId = button.customId || 'Sem CustomId';

              addLog(botId, {
                type: 'success',
                message: `[${guildName}] #${channelName} -> Botão: ${buttonLabel} (${customId})`,
                server: guildName,
                channel: channelName,
              });
            } catch (err: any) {
              const guildName = (channel as any).guild?.name || 'Servidor Desconhecido';
              const channelName = (channel as any).name || 'Canal Desconhecido';
              addLog(botId, {
                type: 'error',
                message: `[${guildName}] #${channelName} -> Erro ao confirmar: ${err.message}`,
                server: guildName,
                channel: channelName,
              });
            }
          }
        }
      }
    } catch (err: any) {
      const guildName = (channel as any).guild?.name || 'Servidor Desconhecido';
      const channelName = (channel as any).name || 'Canal Desconhecido';
      addLog(botId, {
        type: 'error',
        message: `[${guildName}] #${channelName} -> Erro ao monitorar: ${err.message}`,
        server: guildName,
        channel: channelName,
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
