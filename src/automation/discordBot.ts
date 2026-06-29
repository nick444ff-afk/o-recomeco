import { addLog } from '../services/logService';
import { incrementStat, setStat } from '../services/statsService';
import { getSettings } from '../services/settingsService';
import { BotConfig } from '../types';

const botInstances: Map<string, {
  client: any;
  isRunning: boolean;
  loopInterval: NodeJS.Timeout | null;
  sentMessages: Set<string>;
  clickedMessages: Set<string>;
}> = new Map();

async function getDiscordClient() {
  const discord = require('discord.js-selfbot-v13');
  return discord.Client;
}

export function isBotRunning(botId: string): boolean {
  return botInstances.get(botId)?.isRunning || false;
}

const cleanName = (str: string) =>
    str.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w-]/g, "")
    .toLowerCase();

// Mapeamento Completo do ZIP
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Mobile': ["mobile", "mob", "celular", "📱"],
    'Emulador': ["emulador", "emu", "emul", "🖥️", "🖥"],
    'Misto': ["misto", "mis", "mix", "🕹️", "🕹"],
    'Tático': ["tatico", "tático", "tat", "❗"]
};

export async function startBot(botId: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getSettings(botId);
    if (!config.token) return { success: false, message: 'Token não configurado.' };

    const Client = await getDiscordClient();
    const client = new Client({ checkUpdate: false });

    await client.login(config.token);
    addLog(botId, { type: 'info', message: `Bot ${botId} logado: ${client.user?.tag}` });

    const instance = {
      client,
      isRunning: true,
      loopInterval: null as NodeJS.Timeout | null,
      sentMessages: new Set<string>(),
      clickedMessages: new Set<string>()
    };
    botInstances.set(botId, instance);

    // Eventos de Reação Imediata
    client.on('messageCreate', (msg: any) => handleAutoLogic(botId, instance, msg, config));
    client.on('messageUpdate', (_old: any, msg: any) => handleAutoLogic(botId, instance, msg, config));

    // Ciclo de Varredura (Conforme ZIP)
    instance.loopInterval = setInterval(async () => {
        if (!instance.isRunning) return;
        await runAutomationCycle(botId, instance, config);
    }, (config.interval || 12) * 1000);

    return { success: true, message: `Logado como ${client.user?.username}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

async function runAutomationCycle(botId: string, instance: any, config: BotConfig) {
    const client = instance.client;
    incrementStat(botId, 'executions');
    setStat(botId, 'lastExecution', new Date());

    // Varredura por todos os modos (1x1 a 4x4) e categorias selecionadas
    for (const [cat, modes] of Object.entries(config.selections || {})) {
        for (const [mode, gelos] of Object.entries(modes)) {
            if (Object.values(gelos).some(v => v)) {
                const modeClean = mode.toLowerCase().replace('v', 'x');
                const catKeywords = CATEGORY_KEYWORDS[cat] || [];
                
                const targets = client.channels.cache.filter((c: any) => {
                    if (c.type !== 'GUILD_TEXT') return false;
                    const name = cleanName(c.name);
                    // Deve conter o modo (ex: 1x1) e a categoria (ex: mob)
                    return name.includes(modeClean) && catKeywords.some(kw => name.includes(cleanName(kw)));
                });

                for (const [, channel] of targets) {
                    try {
                        const msgs = await (channel as any).messages.fetch({ limit: 10 });
                        for (const [, msg] of msgs) {
                            await handleAutoLogic(botId, instance, msg, config, { cat, mode, gelos });
                        }
                    } catch (e) {}
                }
            }
        }
    }

    // Monitoramento Global de Filas
    const globals = client.channels.cache.filter((c: any) => 
        c.viewable && (c.type === 'GUILD_TEXT' || c.type === 'GUILD_PRIVATE_THREAD') &&
        ['fila', 'partida', 'aguardando'].some(kw => c.name?.toLowerCase().includes(kw))
    );

    for (const [, channel] of globals) {
        try {
            const msgs = await (channel as any).messages.fetch({ limit: 5 });
            for (const [, msg] of msgs) {
                await handleAutoLogic(botId, instance, msg, config);
            }
        } catch (e) {}
    }
}

async function handleAutoLogic(botId: string, instance: any, msg: any, config: BotConfig, target?: any) {
    if (!instance.isRunning || !msg.channel || !msg.channel.name) return;
    const channel = msg.channel;

    // 1. Mensagem Automática
    if (config.message && ['fila', 'partida', 'aguardando'].some(kw => channel.name.toLowerCase().includes(kw))) {
        const key = `msg_${channel.id}`;
        if (!instance.sentMessages.has(key)) {
            try {
                await channel.send(config.message);
                instance.sentMessages.add(key);
                incrementStat(botId, 'messagesSent');
                addLog(botId, { type: 'success', message: `Mensagem enviada em #${channel.name}` });
                setTimeout(() => instance.sentMessages.delete(key), 120000);
            } catch (e) {}
        }
    }

    // 2. Cliques em Botões
    if (!msg.components?.length || instance.clickedMessages.has(msg.id)) return;

    const allButtons: any[] = [];
    for (const row of msg.components) {
        for (const btn of row.components) if (btn.customId) allButtons.push(btn);
    }

    // A. Prioridade 1: Gelo Específico (Foco em 1x1 Mobile/Emulador conforme solicitado)
    if (target) {
        const geloKeywords = ["gel normal", "gel inf", "gelo normal", "gelo infinito"];
        for (const [geloName, active] of Object.entries(target.gelos)) {
            if (!active) continue;
            const kw = geloName.toLowerCase();
            const btn = allButtons.find(b => {
                const text = `${b.label || ''} ${b.customId}`.toLowerCase();
                return text.includes(kw);
            });
            if (btn) return await executeClick(botId, instance, msg, btn, channel.name, `GELO:${geloName.toUpperCase()}`);
        }
    }

    // B. Prioridade 2: Categoria (Mobile, Emulador, Misto, Tático)
    if (target) {
        const keywords = CATEGORY_KEYWORDS[target.cat] || [];
        const btn = allButtons.find(b => {
            const text = `${b.label || ''} ${b.customId} ${b.emoji?.name || ''}`.toLowerCase();
            return keywords.some(kw => text.includes(kw.toLowerCase()));
        });
        if (btn) return await executeClick(botId, instance, msg, btn, channel.name, `CAT:${target.cat.toUpperCase()}`);
    }

    // C. Fallback: Botão Genérico de Entrada (Conforme ZIP)
    const forbidden = ['sair', 'leave', 'cancelar', 'fechar', 'finalizar', 'recusar', 'leave_player'];
    const actionBtn = allButtons.find(b => {
        const text = `${b.label || ''} ${b.customId}`.toLowerCase();
        return !forbidden.some(f => text.includes(f));
    });
    if (actionBtn) return await executeClick(botId, instance, msg, actionBtn, channel.name, "ENTRAR");
}

async function executeClick(botId: string, instance: any, msg: any, button: any, channelName: string, type: string) {
    try {
        await msg.clickButton(button.customId);
        instance.clickedMessages.add(msg.id);
    setTimeout(() => instance.clickedMessages.delete(msg.id), 600000); // 10 minutos de cache
        incrementStat(botId, 'buttonsClicked');
        addLog(botId, { type: 'success', message: `[${type}] Clicado "${button.label || button.customId}" em #${channelName}` });
        return true;
    } catch (e: any) {
        addLog(botId, { type: 'error', message: `Erro ao clicar em #${channelName}: ${e.message}` });
        return false;
    }
}

export async function stopBot(botId: string): Promise<{ success: boolean; message: string }> {
  const instance = botInstances.get(botId);
  if (!instance) return { success: false, message: 'Parado.' };
  instance.isRunning = false;
  if (instance.loopInterval) clearInterval(instance.loopInterval);
  try { instance.client.destroy(); } catch (e) {}
  botInstances.delete(botId);
  return { success: true, message: 'Desligado.' };
}
