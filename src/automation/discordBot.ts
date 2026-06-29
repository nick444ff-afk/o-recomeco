import { addLog } from '../services/logService';
import { incrementStat, setStat } from '../services/statsService';
import { getSettings } from '../services/settingsService';
import { BotConfig } from '../types';

const botInstances: Map<string, {
  client: any;
  isRunning: boolean;
  loopInterval: NodeJS.Timeout | null;
  processing: Set<string>;
  sentMessages: Set<string>;
  clickedMessages: Set<string>;
}> = new Map();

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

const cleanName = (str: string) =>
    str.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w-]/g, "")
    .toLowerCase();

// Lógica de Regex de Valor extraída do ZIP
const createValorRegex = (valor: number) => {
    const inteiro = Math.floor(valor);
    const decimal = Math.round((valor - inteiro) * 100);
    const decPart = decimal ? `[.,]?${decimal}` : "(?:[.,]?\\d{2})?";
    return new RegExp(
        `(?:r\\$|rs)\\s*${inteiro}${decPart}` +
        `|(?:r\\$|rs)?\\s*\\d+(?:[.,]?\\d{2})?\\s*/\\s*(?:r\\$|rs)?\\s*${inteiro}`,
        "i"
    );
};

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
    const client = new Client({ checkUpdate: false });

    await client.login(config.token);
    addLog(botId, { type: 'info', message: `Logado como "${client.user?.username}"` });

    const instance = {
      client,
      isRunning: true,
      loopInterval: null as NodeJS.Timeout | null,
      processing: new Set<string>(),
      sentMessages: new Set<string>(),
      clickedMessages: new Set<string>()
    };

    botInstances.set(botId, instance);

    // Loop de Automação Principal (Inspirado no setInterval do ZIP)
    instance.loopInterval = setInterval(async () => {
        if (!instance.isRunning) return;
        try {
            await runAutomationCycle(botId, instance, config);
        } catch (e: any) {
            console.error(`Erro no ciclo: ${e.message}`);
        }
    }, 3000); // Roda a cada 3 segundos

    return { success: true, message: `Logado como ${client.user?.username}` };
  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro ao logar: ${err.message}` });
    return { success: false, message: `Erro: ${err.message}` };
  }
}

async function runAutomationCycle(botId: string, instance: any, config: BotConfig) {
    const client = instance.client;
    
    // Atualiza estatísticas
    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    // 1. Escaneamento de Canais (Keywords globais do ZIP)
    const channelsToMonitor = client.channels.cache.filter((c: any) => 
        c.guild && 
        (c.type === 'GUILD_TEXT' || c.type === 'GUILD_PRIVATE_THREAD') &&
        (c.name?.toLowerCase().includes("aguardando") || 
         c.name?.toLowerCase().includes("partida") || 
         c.name?.toLowerCase().includes("fila")) &&
        c.viewable
    );

    for (const [, channel] of channelsToMonitor) {
        if (instance.processing.has(channel.id)) continue;
        
        // Marca canal como em processamento para evitar conflitos
        instance.processing.add(channel.id);
        
        try {
            const messages = await (channel as any).messages.fetch({ limit: 5 });
            const firstMsg = messages.find((m: any) => m.components?.length > 0);

            // A. Envio Automático (Evita mensagens fantasmas com tracker rigoroso)
            if (config.message && config.message.trim() !== '') {
                const sentKey = `${channel.id}_${config.message.slice(0, 10)}`;
                if (!instance.sentMessages.has(sentKey)) {
                    try {
                        await (channel as any).send(config.message);
                        instance.sentMessages.add(sentKey);
                        incrementStat(botId, 'messagesSent');
                        addLog(botId, { type: 'success', message: `Mensagem enviada em "${channel.name}"` });
                        
                        // Limpa o tracker após 2 minutos para permitir re-envio se necessário
                        setTimeout(() => instance.sentMessages.delete(sentKey), 120000);
                    } catch (err: any) {
                        if (err.message.includes('Missing Permissions')) {
                            addLog(botId, { type: 'error', message: `Sem permissão para enviar em "${channel.name}"` });
                        }
                    }
                }
            }

            // B. Lógica de Cliques (Focada nos requisitos e lógica do ZIP)
            if (firstMsg) {
                await handleButtonClicks(botId, instance, firstMsg, channel, config);
            }

        } catch (e) {} finally {
            // Libera o canal após processar
            setTimeout(() => instance.processing.delete(channel.id), 5000);
        }
    }

    // 2. Escaneamento Específico por Categoria/Modo (Lógica de Scan do ZIP)
    const tipoMap: Record<string, string> = { 'Tático': 'tatico', 'Mobile': 'mob', 'Emulador': 'emu', 'Misto': 'mis' };
    const valorRegex = createValorRegex(config.value || 0);

    for (const categoria of config.categories) {
        const tipo = tipoMap[categoria];
        if (!tipo) continue;

        for (const modo of config.modes) {
            const variations = [modo.toLowerCase(), modo.replace('v', 'x').toLowerCase()];
            
            const specificChannels = client.channels.cache.filter((c: any) => {
                if (c.type !== 'GUILD_TEXT') return false;
                const name = cleanName(c.name);
                return name.includes(tipo) && variations.some(v => name.includes(v));
            });

            for (const [, channel] of specificChannels) {
                try {
                    const msgs = await (channel as any).messages.fetch({ limit: 10 });
                    for (const [, msg] of msgs) {
                        // Verifica se a mensagem tem o valor configurado e botões
                        let fullText = msg.content || "";
                        for (const embed of msg.embeds) {
                            fullText += ` ${embed.title || ""} ${embed.description || ""}`;
                            if (embed.fields?.length) fullText += " " + embed.fields.map((f: any) => `${f.name}: ${f.value}`).join(" ");
                        }

                        if (valorRegex.test(fullText) && msg.components?.length) {
                            await handleButtonClicks(botId, instance, msg, channel, config);
                        }
                    }
                } catch (e) {}
            }
        }
    }
}

async function handleButtonClicks(botId: string, instance: any, msg: any, channel: any, config: BotConfig) {
    if (instance.clickedMessages.has(msg.id)) return;

    const allowedPriority = ["gel normal", "gel inf", "gelo normal", "gelo infinito"];
    const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar'];

    for (const row of msg.components) {
        // Primeiro tenta os botões de prioridade solicitados
        for (const button of row.components) {
            const label = (button.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const customId = (button.customId || '').toLowerCase();

            if (allowedPriority.some(b => label.includes(b) || customId.includes(b))) {
                try {
                    await msg.clickButton(button.customId);
                    instance.clickedMessages.add(msg.id);
                    incrementStat(botId, 'buttonsClicked');
                    addLog(botId, { type: 'success', message: `Botão PRIORITÁRIO "${button.label}" clicado em "${channel.name}"` });
                    return;
                } catch (err: any) {
                    handleClickError(botId, err, channel.name);
                }
            }
        }

        // Se não achou prioridade, tenta qualquer botão de ação (lógica do ZIP)
        for (const button of row.components) {
            const label = (button.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const customId = (button.customId || '').toLowerCase();

            if (!forbidden.some(f => label.includes(f) || customId.includes(f))) {
                try {
                    await msg.clickButton(button.customId);
                    instance.clickedMessages.add(msg.id);
                    incrementStat(botId, 'buttonsClicked');
                    addLog(botId, { type: 'success', message: `Botão de ação "${button.label}" clicado em "${channel.name}"` });
                    return;
                } catch (err: any) {
                    handleClickError(botId, err, channel.name);
                }
            }
        }
    }
}

function handleClickError(botId: string, err: any, channelName: string) {
    if (err.message.includes('Missing Permissions')) {
        addLog(botId, { type: 'error', message: `Sem permissão para clicar em "${channelName}"` });
    } else {
        addLog(botId, { type: 'error', message: `Erro ao clicar: ${err.message}` });
    }
}

export async function stopBot(botId: string): Promise<{ success: boolean; message: string }> {
  const instance = botInstances.get(botId);
  if (!instance) return { success: false, message: 'Bot não está em execução.' };
  
  instance.isRunning = false;
  if (instance.loopInterval) clearInterval(instance.loopInterval);
  try { instance.client.destroy(); } catch (e) {}
  
  botInstances.delete(botId);
  addLog(botId, { type: 'warn', message: 'Bot desligado.' });
  return { success: true, message: 'Bot desligado.' };
}
