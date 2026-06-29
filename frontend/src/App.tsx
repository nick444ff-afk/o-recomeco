import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_URL = '/api';

interface LogEntry {
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

interface SelectionState {
  [category: string]: {
    [mode: string]: {
      [gelo: string]: boolean;
    };
  };
}

const CATEGORIES = ['Mobile', 'Emulador', 'Misto', 'Tático'];
const MODES = ['1x1', '2x2', '3x3', '4x4'];
const GELOS = ['Gel Normal', 'Gel Inf'];

function App() {
  const [botAtivo, setBotAtivo] = useState('BOT1');
  const [botLigado, setBotLigado] = useState(false);
  const [conexao, setConexao] = useState(false);
  const [stats, setStats] = useState({ entradas: 0, na_fila: 0, partidas: 0, dms: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '', visible: false });
  const [tokenError, setTokenError] = useState('');
  const [configMessage, setConfigMessage] = useState('');

  const [selections, setSelections] = useState<SelectionState>(() => {
    const initial: SelectionState = {};
    CATEGORIES.forEach(cat => {
      initial[cat] = {};
      MODES.forEach(mod => {
        initial[cat][mod] = {};
        GELOS.forEach(gel => {
          initial[cat][mod][gel] = false;
        });
      });
    });
    return initial;
  });

  const tokensRef = useRef<HTMLTextAreaElement>(null);
  const mensagemRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<HTMLInputElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const uptimeRef = useRef<any>(null);

  const showToast = useCallback((msg: string, type: string) => {
    setToast({ msg, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  }, []);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warn' | 'error') => {
    setLogs(prev => {
      if (prev.length > 0 && prev[prev.length - 1].message === msg && prev[prev.length - 1].type === type) {
        return prev;
      }
      const next = [...prev, { message: msg, type }];
      return next.slice(-200);
    });
  }, []);

  // Verificar conexão
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_URL}/`);
        setConexao(true);
      } catch {
        setConexao(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Atualizar status do bot
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_URL}/status/${botAtivo}`);
        setBotLigado(res.data.is_running);
        if (res.data.stats) {
          setStats({
            entradas: res.data.stats.entradas || 0,
            na_fila: res.data.stats.na_fila || 0,
            partidas: res.data.stats.partidas || 0,
            dms: res.data.stats.dms || 0,
          });
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [botAtivo]);

  // Fetch logs
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API_URL}/logs/${botAtivo}`);
        if (res.data.logs && res.data.logs.length > 0) {
          res.data.logs.forEach((log: LogEntry) => {
            addLog(log.message, log.type);
          });
        }
      } catch {}
    };
    const interval = setInterval(fetch, 2000);
    return () => clearInterval(interval);
  }, [botAtivo, addLog]);

  // Uptime counter
  useEffect(() => {
    if (botLigado) {
      if (!uptimeRef.current) {
        uptimeRef.current = setInterval(() => {
          setUptimeSeconds(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (uptimeRef.current) {
        clearInterval(uptimeRef.current);
        uptimeRef.current = null;
        setUptimeSeconds(0);
      }
    }
    return () => {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    };
  }, [botLigado]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Carregar configuração inicial
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/settings/${botAtivo}`);
        const config = res.data;
        if (config) {
          if (tokensRef.current) tokensRef.current.value = config.token || '';
          if (mensagemRef.current) mensagemRef.current.value = config.message || '';
          if (intervalRef.current) intervalRef.current.value = config.interval?.toString() || '12';
          if (config.selections) setSelections(config.selections);
        }
      } catch {}
    };
    load();
  }, [botAtivo]);

  const handleCheckboxChange = (cat: string, mod: string, gel: string) => {
    setSelections(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [mod]: {
          ...prev[cat][mod],
          [gel]: !prev[cat][mod][gel]
        }
      }
    }));
  };

  const mudarBot = (bot: string) => {
    if (bot === botAtivo) return;
    setBotAtivo(bot);
    setUptimeSeconds(0);
    addLog(`Trocado para ${bot}`, 'info');
    showToast(`Trocado para ${bot}`, 'info');
  };

  const toggleBot = async () => {
    const action = botLigado ? 'stop_bot' : 'start_bot';
    try {
      const res = await axios.post(`${API_URL}/${action}/${botAtivo}`);
      if (res.data.status === 'success') {
        showToast(botLigado ? 'Bot Parado' : 'Bot Iniciado', botLigado ? 'warn' : 'success');
        addLog(res.data.message, botLigado ? 'warn' : 'success');
      } else {
        showToast(res.data.message, 'error');
        addLog(res.data.message, 'error');
      }
    } catch (err: any) {
      showToast('Erro de conexão', 'error');
      addLog('Erro ao conectar com servidor', 'error');
    }
  };

  const resetStats = async () => {
    try {
      await axios.post(`${API_URL}/reset_stats/${botAtivo}`);
      setStats({ entradas: 0, na_fila: 0, partidas: 0, dms: 0 });
      setUptimeSeconds(0);
      showToast('Stats resetados', 'warn');
      addLog('Stats resetados', 'warn');
    } catch {
      showToast('Erro ao resetar', 'error');
    }
  };

  const salvarConfiguracao = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setTokenError('');
    setConfigMessage('');

    try {
      const tokens = tokensRef.current?.value.trim() || '';
      const mensagem = mensagemRef.current?.value.trim() || '';
      const interval = intervalRef.current ? parseInt(intervalRef.current.value, 10) : 12;

      if (!tokens) {
        setTokenError('❌ Token obrigatório');
        setIsSaving(false);
        return;
      }

      const res = await axios.post(`${API_URL}/save_config`, {
        bot_id: botAtivo,
        tokens,
        message: mensagem,
        selections,
        interval
      });

      if (res.status === 200) {
        showToast('Configuração Salva!', 'success');
        setConfigMessage('✅ Salvo com sucesso');
        addLog('Configuração salva', 'success');
        setTimeout(() => setConfigMessage(''), 3000);
      }
    } catch (err: any) {
      showToast('Erro ao salvar', 'error');
      addLog(`Erro: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const limparLogs = () => {
    setLogs([]);
    addLog('Logs limpos', 'info');
  };

  const formatUptime = () => {
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    const s = uptimeSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="systemx-app">
      <style>{appStyles}</style>
      <div className="container">
        {/* HEADER */}
        <div className="card header">
          <div className="logo">
            <img src="https://i.imgur.com/llnJtbZ.png" alt="Logo" />
          </div>
          <h1 className="title">SystemX</h1>
          <p className="subtitle">PAINEL DE CONTROLE</p>

          <div className="status">
            <div className={`badge ${conexao ? 'badge-green' : 'badge-red'}`}>
              {conexao ? 'Conectado' : 'Desconectado'}
            </div>
            <div className={`badge ${botLigado ? 'badge-green' : 'badge-red'}`}>
              {botLigado ? 'Ativo' : 'Parado'}
            </div>
          </div>

          <div className="bot-tabs">
            {['BOT1', 'BOT2', 'BOT3'].map(b => (
              <div key={b} className={botAtivo === b ? 'active' : ''} onClick={() => mudarBot(b)}>{b}</div>
            ))}
          </div>

          <p className="instancia-text">INSTÂNCIA ATIVA: {botAtivo}</p>
        </div>

        {/* CONTROLE */}
        <div className={`card ${botLigado ? 'bot-ligado' : ''}`}>
          <div className="controle-header">
            <h3>Controle - {botAtivo.replace('BOT', 'Bot ')}</h3>
            <span className="bot-indicator">{botAtivo}</span>
          </div>

          <div className="play-wrapper">
            <div className={`play ${botLigado ? 'ligado' : ''}`} onClick={toggleBot}>
              {!botLigado && <div className="icon-play"></div>}
              {botLigado && <div className="icon-stop"></div>}
            </div>
            <p className={`play-label ${botLigado ? 'ligado' : ''}`}>
              {botLigado ? `${botAtivo} em execução...` : 'Clique para iniciar o bot'}
            </p>
          </div>
        </div>

        {/* STATS */}
        <div className="card stat">
          <div className="stat-title">Entradas</div>
          <div className="stat-value">{stats.entradas}</div>
        </div>
        <div className="card stat">
          <div className="stat-title">Na Fila</div>
          <div className="stat-value green-text">{stats.na_fila}</div>
        </div>
        <div className="card stat">
          <div className="stat-title">Partidas</div>
          <div className="stat-value purple-text">{stats.partidas}</div>
        </div>
        <div className="card stat">
          <div className="stat-title">DMs</div>
          <div className="stat-value cyan-text">{stats.dms}</div>
        </div>
        <div className="card stat">
          <div className="stat-title">Uptime</div>
          <div className="stat-value yellow-text">{formatUptime()}</div>
        </div>

        {/* RESET */}
        <div className="reset-container">
          <button className="reset-btn" onClick={resetStats}>RESETAR STATS</button>
        </div>

        {/* CONFIGURAÇÃO */}
        <div className="card">
          <h3>Configuração</h3>

          <label>Tokens</label>
          <textarea ref={tokensRef} rows={3} placeholder="Cole seus tokens aqui (um por linha)"></textarea>
          {tokenError && <div className="error-message">{tokenError}</div>}

          <label>Mensagem Automática</label>
          <input type="text" ref={mensagemRef} placeholder="Mensagem para enviar na fila" />

          <label>Intervalo de Scan (segundos)</label>
          <input type="number" ref={intervalRef} defaultValue={12} min={2} max={60} />

          <label>Seleção de Alvos (Cascata)</label>
          <div className="cascata-container">
            {CATEGORIES.map(cat => (
              <div key={cat} className="cat-group">
                <div className="cat-header">{cat}</div>
                <div className="modes-grid">
                  {MODES.map(mod => (
                    <div key={mod} className="mod-column">
                      <div className="mod-header">{mod}</div>
                      {GELOS.map(gel => (
                        <label key={gel} className="checkbox-item">
                          <input 
                            type="checkbox" 
                            checked={selections[cat][mod][gel]} 
                            onChange={() => handleCheckboxChange(cat, mod, gel)}
                          />
                          <span>{gel}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="save-btn" onClick={salvarConfiguracao} disabled={isSaving}>
            {isSaving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÃO'}
          </button>
          {configMessage && <div className="success-message">{configMessage}</div>}
        </div>

        {/* LOGS */}
        <div className="card">
          <h3>Logs</h3>
          <div className="logs" ref={logsRef}>
            {logs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className={`log-${log.type}`}>{log.message}</span>
              </div>
            ))}
          </div>
          <button className="clear-logs-btn" onClick={limparLogs} style={{ marginTop: '12px', width: '100%' }}>
            LIMPAR LOGS
          </button>
        </div>
      </div>

      {/* TOAST */}
      <div className={`toast ${toast.visible ? 'show' : ''} ${toast.type}`}>
        {toast.msg}
      </div>
    </div>
  );
}

const appStyles = `
.systemx-app {
  margin: 0;
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #050c1f, #0b1f47);
  color: #e5e7eb;
  min-height: 100vh;
}
.container {
  max-width: 500px;
  margin: auto;
  padding: 15px;
}
.card {
  background: linear-gradient(145deg, #0b1f47, #08142e);
  border-radius: 22px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 10px 40px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.5);
}
.card.bot-ligado {
  border-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 10px 40px rgba(239,68,68,0.25), inset 0 0 40px rgba(0,0,0,0.5);
}
.header { text-align: center; }
.logo { width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 22px; background: linear-gradient(145deg, #1e3a8a, #1d4ed8); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 0 25px rgba(59,130,246,0.4); }
.logo img { width: 100%; height: 100%; object-fit: cover; }
.title { font-size: 26px; font-weight: 700; letter-spacing: 4px; }
.subtitle { opacity: 0.6; font-size: 13px; margin-top: 5px; }
.status { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
.badge { padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.badge-green { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
.badge-red { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
.bot-tabs { display: flex; background: #091a36; border-radius: 30px; padding: 6px; margin-top: 15px; }
.bot-tabs div { flex: 1; text-align: center; padding: 10px; border-radius: 20px; cursor: pointer; transition: all 0.3s ease; font-weight: 600; user-select: none; }
.bot-tabs div:hover:not(.active) { background: rgba(255,255,255,0.07); }
.bot-tabs .active { background: #e5e7eb; color: #000; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.play-wrapper { display: flex; flex-direction: column; align-items: center; margin: 30px 0 10px; }
.play { width: 140px; height: 140px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.35s ease; position: relative; background: rgba(255,255,255,0.03); user-select: none; }
.play:hover { transform: scale(1.06); box-shadow: 0 0 30px rgba(255,255,255,0.2); }
.play:active { transform: scale(0.97); }
.play .icon-play { width: 0; height: 0; border-left: 32px solid #fff; border-top: 20px solid transparent; border-bottom: 20px solid transparent; margin-left: 8px; }
.play .icon-stop { width: 26px; height: 26px; background: #ef4444; border-radius: 4px; animation: blink 1.2s infinite; }
.play.ligado { border-color: #ef4444; box-shadow: 0 0 35px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.2); background: rgba(239,68,68,0.08); }
.play.ligado:hover { box-shadow: 0 0 45px rgba(239,68,68,0.65), 0 0 70px rgba(239,68,68,0.25); }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.play-label { margin-top: 14px; font-size: 13px; opacity: 0.65; text-align: center; transition: color 0.3s; letter-spacing: 0.5px; }
.play-label.ligado { color: #f87171; opacity: 1; font-weight: 600; }
.card.stat { padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
.stat-title { font-size: 14px; opacity: 0.65; font-weight: 500; }
.stat-value { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.green-text { color: #22c55e; }
.purple-text { color: #a855f7; }
.cyan-text { color: #06b6d4; }
.yellow-text { color: #facc15; }
.reset-container { margin: 0 0 20px; padding: 0; }
.reset-btn { width: 100%; padding: 14px; border-radius: 14px; border: 1px solid rgba(255, 80, 80, 0.4); background: rgba(255, 80, 80, 0.08); color: #ff5a5a; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; backdrop-filter: blur(6px); letter-spacing: 0.5px; }
.reset-btn:hover { background: rgba(255, 80, 80, 0.18); border-color: rgba(255, 80, 80, 0.7); box-shadow: 0 0 15px rgba(255,80,80,0.2); }
.reset-btn:active { transform: scale(0.97); }
label { margin-top: 15px; display: block; font-size: 14px; font-weight: 500; opacity: 0.85; }
input, textarea, select { width: 100%; padding: 14px; margin-top: 6px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.07); background: #020617; color: #fff; font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
input:focus, textarea:focus, select:focus { border-color: rgba(34,211,238,0.4); }
.cascata-container { background: #020617; border-radius: 14px; padding: 10px 15px; max-height: 300px; overflow-y: auto; margin-top: 8px; border: 1px solid rgba(255,255,255,0.06); box-shadow: inset 0 0 20px rgba(0,0,0,0.6); }
.cat-group { margin-bottom: 15px; border-bottom: 1px solid #1e3a8a; padding-bottom: 10px; }
.cat-group:last-child { border: none; }
.cat-header { color: #3b82f6; font-weight: bold; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
.modes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.mod-header { font-size: 12px; font-weight: bold; color: #94a3b8; margin-bottom: 5px; }
.checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 11px; cursor: pointer; margin-bottom: 4px; }
.checkbox-item input { width: 14px; height: 14px; margin: 0; }
.save-btn { width: 100%; padding: 15px; margin-top: 20px; border: none; border-radius: 12px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; letter-spacing: 0.5px; transition: all 0.25s ease; box-shadow: 0 4px 15px rgba(29,78,216,0.35); }
.save-btn:hover { background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 6px 20px rgba(29,78,216,0.5); transform: translateY(-1px); }
.save-btn:active { transform: scale(0.98) translateY(0); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.logs { background: #000; padding: 15px; border-radius: 12px; font-family: 'Courier New', monospace; font-size: 13px; height: 200px; overflow-y: auto; line-height: 1.6; border: 1px solid rgba(255,255,255,0.05); }
.logs::-webkit-scrollbar { width: 5px; }
.logs::-webkit-scrollbar-track { background: #000; }
.logs::-webkit-scrollbar-thumb { background: #1d4ed8; border-radius: 3px; }
.log-entry { margin: 2px 0; }
.log-info { color: #22d3ee; }
.log-success { color: #22c55e; }
.log-warn { color: #facc15; font-weight: 600; }
.log-error { color: #f87171; }
.clear-logs-btn { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,90,90,0.35); background: rgba(255,90,90,0.1); color: #ff5a5a; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s ease; }
.clear-logs-btn:hover { background: rgba(255,90,90,0.2); border-color: rgba(255,90,90,0.6); box-shadow: 0 0 12px rgba(255,90,90,0.2); }
.clear-logs-btn:active { transform: scale(0.97); }
.toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(80px); background: #1d4ed8; color: #fff; padding: 12px 24px; border-radius: 30px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 25px rgba(0,0,0,0.5); z-index: 9999; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease; opacity: 0; white-space: nowrap; }
.toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
.toast.success { background: #16a34a; }
.toast.error { background: #dc2626; }
.toast.warn { background: #ca8a04; }
.instancia-text { opacity: 0.6; margin-top: 10px; font-size: 13px; letter-spacing: 0.5px; }
.controle-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0; }
.controle-header h3 { margin: 0; }
.bot-indicator { font-size: 12px; padding: 4px 12px; border-radius: 20px; background: rgba(34,211,238,0.12); color: #22d3ee; font-weight: 600; border: 1px solid rgba(34,211,238,0.25); }
.error-message { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-top: 10px; }
.success-message { background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); color: #22d3ee; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-top: 10px; }
`;

export default App;
