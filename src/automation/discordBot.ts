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

// Keywords de Categoria extraídas do novo ZIP
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    mobile: ["mobile", "mob", "celular", "📱"],
    emulador: ["emulador", "emu", "emul", "🖥️", "🖥"],
    misto: ["misto", "mis", "mix", "🕹️", "🕹"],
    tatico: ["tatico", "tático", "tat", "❗"]
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

    // Eventos em tempo real (Resposta imediata do ZIP)
    client.on('messageCreate', async (msg: any) => {
        if (!instance.isRunning) return;
        await handleAutoLogic(botId, instance, msg, config);
    });

    client.on('messageUpdate', async (_old: any, msg: any) => {
        if (!instance.isRunning) return;
        await handleAutoLogic(botId, instance, msg, config);
    });

    // Ciclo de Varredura (A cada 3 segundos - Lógica aprimorada do novo ZIP)
    instance.loopInterval = setInterval(async () => {
        if (!instance.isRunning) return;
        try {
            await runAutomationCycle(botId, instance, config);
        } catch (e: any) {}
    }, 3000);

    return { success: true, message: `Logado como ${client.user?.username}` };
  } catch (err: any) {
    addLog(botId, { type: 'error', message: `Erro ao logar: ${err.message}` });
    return { success: false, message: `Erro: ${err.message}` };
  }
}

async function runAutomationCycle(botId: string, instance: any, config: BotConfig) {
    const client = instance.client;
    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    const keywords = ["aguardando", "partida", "fila"];
    const tipoMap: Record<string, string> = { 'Tático': 'tatico', 'Mobile': 'mobile', 'Emulador': 'emulador', 'Misto': 'misto' };

    // 1. Varredura por Categoria/Modo (Fiel ao findCorrectButton do novo ZIP)
    for (const categoria of config.categories) {
        const catKey = tipoMap[categoria];
        if (!catKey) continue;

        for (const modo of config.modes) {
            const variations = [modo.toLowerCase(), modo.replace('v', 'x').toLowerCase()];
            const specificChannels = client.channels.cache.filter((c: any) => {
                if (c.type !== 'GUILD_TEXT') return false;
                const name = cleanName(c.name);
                // Busca canais que tenham o modo (1x1) e a categoria (mob/emu...)
                return variations.some(v => name.includes(v)) && 
                       CATEGORY_KEYWORDS[catKey].some(kw => name.includes(kw.replace(/[^\w]/g, '')));
            });

            for (const [, channel] of specificChannels) {
                try {
                    const msgs = await (channel as any).messages.fetch({ limit: 10 });
                    for (const [, msg] of msgs) {
                        await handleAutoLogic(botId, instance, msg, config, catKey);
                    }
                } catch (e) {}
            }
        }
    }

    // 2. Monitoramento Global (Canais de Fila/Partida)
    const monitoredChannels = client.channels.cache.filter((c: any) => 
        c.guild && 
        (c.type === 'GUILD_TEXT' || c.type === 'GUILD_PRIVATE_THREAD') &&
        keywords.some(kw => c.name?.toLowerCase().includes(kw)) &&
        c.viewable
    );

    for (const [, channel] of monitoredChannels) {
        try {
            const messages = await (channel as any).messages.fetch({ limit: 5 });
            for (const [, msg] of messages) {
                await handleAutoLogic(botId, instance, msg, config);
            }
        } catch (e) {}
    }
}

async function handleAutoLogic(botId: string, instance: any, msg: any, config: BotConfig, forceCategory?: string) {
    const channel = msg.channel;
    if (!channel || !channel.name) return;

    // A. Mensagem Automática (Tracker Rigoroso)
    if (config.message && config.message.trim() !== '') {
        const keywords = ['aguardando', 'partida', 'fila'];
        if (keywords.some(kw => channel.name.toLowerCase().includes(kw))) {
            const sentKey = `msg_${channel.id}`;
            if (!instance.sentMessages.has(sentKey)) {
                try {
                    await channel.send(config.message);
                    instance.sentMessages.add(sentKey);
                    incrementStat(botId, 'messagesSent');
                    addLog(botId, { type: 'success', message: `Mensagem enviada em "${channel.name}"` });
                    setTimeout(() => instance.sentMessages.delete(sentKey), 120000);
                } catch (e) {}
            }
        }
    }

    // B. Lógica de Cliques (Inspirada no novo ZIP)
    if (!msg.components || msg.components.length === 0) return;
    if (instance.clickedMessages.has(msg.id)) return;

    const allowedGelo = ["gel normal", "gel inf", "gelo normal", "gelo infinito"];
    const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar', 'leave_player'];

    // Coletar todos os botões
    const allButtons: any[] = [];
    for (const row of msg.components) {
        for (const btn of row.components) {
            if (btn.customId) allButtons.push(btn);
        }
    }

    // 1. Prioridade: Botões de Gelo solicitados pelo usuário
    for (const btn of allButtons) {
        const label = (btn.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const customId = (btn.customId || '').toLowerCase();
        if (allowedGelo.some(g => label.includes(g) || customId.includes(g))) {
            return await executeClick(botId, instance, msg, btn, channel.name, "PRIORIDADE GELO");
        }
    }

    // 2. Prioridade: Botão da Categoria (Lógica findCorrectButton do novo ZIP)
    if (forceCategory && CATEGORY_KEYWORDS[forceCategory]) {
        const keywords = CATEGORY_KEYWORDS[forceCategory];
        for (const btn of allButtons) {
            const searchText = `${btn.customId} ${btn.label || ""} ${btn.emoji?.name || ""}`.toLowerCase();
            if (keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
                return await executeClick(botId, instance, msg, btn, channel.name, `CATEGORIA ${forceCategory.toUpperCase()}`);
            }
        }
    }

    // 3. Fallback: Qualquer botão de ação válido (Lógica genérica do ZIP)
    for (const btn of allButtons) {
        const label = (btn.label || '').toLowerCase();
        const customId = btn.customId.toLowerCase();
        if (!forbidden.some(f => label.includes(f) || customId.includes(f))) {
            return await executeClick(botId, instance, msg, btn, channel.name, "AÇÃO GENÉRICA");
        }
    }
}

async function executeClick(botId: string, instance: any, msg: any, button: any, channelName: string, typeLabel: string) {
    try {
        await msg.clickButton(button.customId);
        instance.clickedMessages.add(msg.id);
        incrementStat(botId, 'buttonsClicked');
        addLog(botId, { type: 'success', message: `[${typeLabel}] Botão "${button.label || button.customId}" clicado em "${channelName}"` });
        return true;
    } catch (e: any) {
        addLog(botId, { type: 'error', message: `Erro ao clicar em "${channelName}": ${e.message}` });
        return false;
    }
}

export async function stopBot(botId: string): Promise<{ success: boolean; message: string }> {
  const instance = botInstances.get(botId);
  if (!instance) return { success: false, message: 'Bot parado.' };
  instance.isRunning = false;
  if (instance.loopInterval) clearInterval(instance.loopInterval);
  try { instance.client.destroy(); } catch (e) {}
  botInstances.delete(botId);
  addLog(botId, { type: 'warn', message: 'Bot desligado.' });
  return { success: true, message: 'Bot desligado.' };
}
