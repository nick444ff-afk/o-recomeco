import { Router, Request, Response } from 'express';
import { startBot, stopBot, isBotRunning } from '../automation/discordBot';
import { getAndClearLogs } from '../services/logService';
import { getStats, resetStats as resetStatsService } from '../services/statsService';
import { getSettings, saveSettings } from '../services/settingsService';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'SystemX Backend Online' });
});

// ═══════════════════════════════════════════════════════════════
// STATUS DO BOT
// ═══════════════════════════════════════════════════════════════
router.get('/status/:botId', (req: Request, res: Response) => {
  const { botId } = req.params;
  const running = isBotRunning(botId);
  const stats = getStats(botId);

  res.json({
    is_running: running,
    status: running ? 'Rodando' : 'Parado',
    stats: {
      entradas: stats.entradas,
      na_fila: stats.buttonsClicked,
      partidas: stats.executions,
      dms: stats.messagesSent,
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// INICIAR BOT
// ═══════════════════════════════════════════════════════════════
router.post('/start_bot/:botId', async (req: Request, res: Response) => {
  const { botId } = req.params;

  try {
    const result = await startBot(botId);
    if (result.success) {
      res.json({ status: 'success', message: result.message });
    } else {
      res.status(400).json({ status: 'error', message: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PARAR BOT
// ═══════════════════════════════════════════════════════════════
router.post('/stop_bot/:botId', async (req: Request, res: Response) => {
  const { botId } = req.params;

  try {
    const result = await stopBot(botId);
    if (result.success) {
      res.json({ status: 'success', message: result.message });
    } else {
      res.status(400).json({ status: 'error', message: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════════════
router.get('/logs/:botId', (req: Request, res: Response) => {
  const { botId } = req.params;
  const logs = getAndClearLogs(botId);
  res.json({ logs });
});

// ═══════════════════════════════════════════════════════════════
// SALVAR CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════
router.post('/save_config', async (req: Request, res: Response) => {
  try {
    const { bot_id, tokens, categories, mensagem, modos } = req.body;

    if (!bot_id) {
      return res.status(400).json({ status: 'error', message: 'bot_id é obrigatório' });
    }

    // Pegar primeiro token da lista
    const tokenList = (tokens || '').split('\n').map((t: string) => t.trim()).filter((t: string) => t);
    const token = tokenList[0] || '';

    const config = await saveSettings(bot_id, {
      token,
      message: mensagem || '',
      categories: categories || [],
      modes: modos || [],
    });

    res.json({ status: 'success', message: 'Configuração salva com sucesso.', config });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// OBTER CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════
router.get('/settings/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const config = await getSettings(botId);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// RESETAR STATS
// ═══════════════════════════════════════════════════════════════
router.post('/reset_stats/:botId', (req: Request, res: Response) => {
  const { botId } = req.params;
  resetStatsService(botId);
  res.json({ status: 'success', message: 'Stats resetados.' });
});

// ═══════════════════════════════════════════════════════════════
// STATS COMPLETAS
// ═══════════════════════════════════════════════════════════════
router.get('/stats/:botId', (req: Request, res: Response) => {
  const { botId } = req.params;
  const stats = getStats(botId);
  res.json(stats);
});

export default router;
