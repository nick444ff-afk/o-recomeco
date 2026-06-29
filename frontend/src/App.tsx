import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_URL = '';

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
  const [logs, setLogs] = useState<{ time: string; message: string; type: string }[]>([]);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '', visible: false });
  const [tokenError, setTokenError] = useState('');
  const [configMessage, setConfigMessage] = useState('');

  // Novo estado de seleção em cascata
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
  const logsRef = useRef<HTMLDivElement>(null);
  const uptimeRef = useRef<any>(null);

  const showToast = useCallback((msg: string, type: string) => {
    setToast({ msg, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  }, []);

  const addLog = useCallback((msg: string, type: string) => {
    setLogs(prev => {
      if (prev.length > 0 && prev[prev.length - 1].message === msg) return prev;
      const next = [...prev, { time: new Date().toLocaleTimeString(), message: msg, type }];
      return next.slice(-200);
    });
  }, []);

  // Sync with Backend
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/status/${botAtivo}`);
        setBotLigado(res.data.is_running);
        if (res.data.stats) setStats(res.data.stats);
        setConexao(true);
      } catch { setConexao(false); }
    };
    checkStatus();
    const int = setInterval(checkStatus, 5000);
    return () => clearInterval(int);
  }, [botAtivo]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${API_URL}/logs/${botAtivo}`);
        res.data.logs?.forEach((l: LogEntry) => addLog(l.message, l.type));
      } catch {}
    };
    const int = setInterval(fetchLogs, 2000);
    return () => clearInterval(int);
  }, [botAtivo, addLog]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await axios.get(`${API_URL}/settings/${botAtivo}`);
        const config = res.data;
        if (config) {
          if (tokensRef.current) tokensRef.current.value = config.token || '';
          if (mensagemRef.current) mensagemRef.current.value = config.message || '';
          if (config.selections) setSelections(config.selections);
          const intervalInput = document.getElementById('interval-input') as HTMLInputElement;
          if (intervalInput) intervalInput.value = config.interval?.toString() || '12';
        }
      } catch {}
    };
    loadConfig();
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

  const salvarConfiguracao = async () => {
    setIsSaving(true);
    setTokenError('');
    try {
      const tokens = tokensRef.current?.value.trim() || '';
      const mensagem = mensagemRef.current?.value.trim() || '';
      const intervalInput = document.getElementById('interval-input') as HTMLInputElement;
      const interval = intervalInput ? parseInt(intervalInput.value, 10) : 12;

      if (!tokens) {
        setTokenError('Token obrigatório');
        setIsSaving(false);
        return;
      }

      await axios.post(`${API_URL}/save_config`, {
        bot_id: botAtivo,
        tokens,
        message: mensagem,
        selections,
        interval
      });

      showToast('Configuração Salva!', 'success');
      setConfigMessage('✅ Salvo com sucesso');
      setTimeout(() => setConfigMessage(''), 3000);
    } catch (err: any) {
      showToast('Erro ao salvar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBot = async () => {
    const action = botLigado ? 'stop_bot' : 'start_bot';
    try {
      const res = await axios.post(`${API_URL}/${action}/${botAtivo}`);
      if (res.data.status === 'success') {
        showToast(botLigado ? 'Bot Parado' : 'Bot Iniciado', botLigado ? 'warn' : 'success');
        setBotLigado(!botLigado);
      }
    } catch { showToast('Erro na conexão', 'error'); }
  };

  return (
    <div className="systemx-app">
      <style>{appStyles}</style>
      <div className="container">
        {/* HEADER */}
        <div className="card header">
          <div className="logo"><img src="https://i.imgur.com/llnJtbZ.png" alt="Logo" /></div>
          <h1 className="title">SystemX</h1>
          <div className="status">
            <div className={`badge ${conexao ? 'badge-green' : 'badge-red'}`}>{conexao ? 'Online' : 'Offline'}</div>
            <div className={`badge ${botLigado ? 'badge-green' : 'badge-red'}`}>{botLigado ? 'Ativo' : 'Parado'}</div>
          </div>
          <div className="bot-tabs">
            {['BOT1', 'BOT2', 'BOT3'].map(b => (
              <div key={b} className={botAtivo === b ? 'active' : ''} onClick={() => setBotAtivo(b)}>{b}</div>
            ))}
          </div>
        </div>

        {/* CONTROLE */}
        <div className={`card ${botLigado ? 'bot-ligado' : ''}`}>
          <div className="play-wrapper">
            <div className={`play ${botLigado ? 'ligado' : ''}`} onClick={toggleBot}>
              {botLigado ? <div className="icon-stop"></div> : <div className="icon-play"></div>}
            </div>
            <p className={`play-label ${botLigado ? 'ligado' : ''}`}>{botLigado ? 'Bot em execução...' : 'Clique para iniciar'}</p>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-grid">
          <div className="card stat"><div className="stat-title">Entradas</div><div className="stat-value">{stats.entradas}</div></div>
          <div className="card stat"><div className="stat-title">Fila</div><div className="stat-value green-text">{stats.na_fila}</div></div>
          <div className="card stat"><div className="stat-title">Partidas</div><div className="stat-value purple-text">{stats.partidas}</div></div>
        </div>

        {/* CONFIGURAÇÃO CASCATA */}
        <div className="card">
          <h3>Configuração de Alvos</h3>
          <label>Token</label>
          <textarea ref={tokensRef} rows={2} placeholder="Token do Discord"></textarea>
          {tokenError && <div className="error-message">{tokenError}</div>}

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

          <label>Mensagem Automática</label>
          <input type="text" ref={mensagemRef} placeholder="Mensagem para enviar na fila" />

          <label>Intervalo de Scan (seg)</label>
          <input type="number" id="interval-input" defaultValue={12} />

          <button className="save-btn" onClick={salvarConfiguracao} disabled={isSaving}>
            {isSaving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÃO'}
          </button>
          {configMessage && <div className="success-message">{configMessage}</div>}
        </div>

        {/* LOGS */}
        <div className="card">
          <h3>Logs do Sistema</h3>
          <div className="logs" ref={logsRef}>
            {logs.map((l, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">[{l.time}]</span>
                <span className={`log-${l.type}`}>{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const appStyles = `
  .systemx-app { background: #050c1f; color: #e5e7eb; min-height: 100vh; font-family: sans-serif; padding: 20px 0; }
  .container { max-width: 600px; margin: auto; padding: 0 15px; }
  .card { background: #0b1f47; border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid #1e3a8a; }
  .header { text-align: center; }
  .logo img { width: 60px; }
  .status { display: flex; justify-content: center; gap: 10px; margin: 15px 0; }
  .badge { padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
  .badge-green { background: #064e3b; color: #34d399; }
  .badge-red { background: #7f1d1d; color: #f87171; }
  .bot-tabs { display: flex; gap: 5px; background: #020617; padding: 5px; border-radius: 10px; margin-top: 10px; }
  .bot-tabs div { flex: 1; padding: 8px; cursor: pointer; border-radius: 8px; text-align: center; transition: 0.3s; }
  .bot-tabs .active { background: #2563eb; color: white; }
  .play-wrapper { text-align: center; }
  .play { width: 80px; height: 80px; border-radius: 50%; border: 4px solid #3b82f6; margin: 0 auto; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .play.ligado { border-color: #ef4444; }
  .icon-play { width: 0; height: 0; border-left: 20px solid #3b82f6; border-top: 12px solid transparent; border-bottom: 12px solid transparent; margin-left: 5px; }
  .icon-stop { width: 20px; height: 20px; background: #ef4444; border-radius: 3px; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .stat { text-align: center; padding: 10px !important; }
  .stat-title { font-size: 12px; opacity: 0.7; }
  .stat-value { font-size: 18px; font-weight: bold; }
  .green-text { color: #34d399; }
  .purple-text { color: #a78bfa; }
  .cascata-container { margin-top: 15px; background: #020617; border-radius: 10px; padding: 10px; border: 1px solid #1e3a8a; }
  .cat-group { margin-bottom: 15px; border-bottom: 1px solid #1e3a8a; padding-bottom: 10px; }
  .cat-group:last-child { border: none; }
  .cat-header { color: #3b82f6; font-weight: bold; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
  .modes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  .mod-header { font-size: 12px; font-weight: bold; color: #94a3b8; margin-bottom: 5px; }
  .checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 11px; cursor: pointer; margin-bottom: 4px; }
  .checkbox-item input { width: 14px; height: 14px; margin: 0; }
  textarea, input { width: 100%; background: #020617; border: 1px solid #1e3a8a; border-radius: 8px; padding: 10px; color: white; margin-top: 5px; box-sizing: border-box; }
  .save-btn { width: 100%; padding: 15px; background: #2563eb; border: none; border-radius: 8px; color: white; font-weight: bold; margin-top: 20px; cursor: pointer; }
  .logs { background: black; height: 150px; overflow-y: auto; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 11px; margin-top: 10px; }
  .log-time { color: #64748b; margin-right: 5px; }
  .log-success { color: #34d399; }
  .log-error { color: #f87171; }
  .log-warn { color: #fbbf24; }
  .log-info { color: #3b82f6; }
`;

export default App;
