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

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

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
    <div style={styles.app}>
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>SystemX</h1>
            <p style={styles.subtitle}>PAINEL DE CONTROLE</p>
          </div>

          <div style={styles.status}>
            <span style={{ ...styles.badge, background: conexao ? '#10b981' : '#ef4444' }}>
              {conexao ? '✓ Conectado' : '✗ Desconectado'}
            </span>
            <span style={{ ...styles.badge, background: botLigado ? '#10b981' : '#ef4444' }}>
              {botLigado ? '✓ Ativo' : '✗ Parado'}
            </span>
          </div>

          <div style={styles.botTabs}>
            {['BOT1', 'BOT2', 'BOT3'].map(b => (
              <button
                key={b}
                onClick={() => mudarBot(b)}
                style={{
                  ...styles.botTab,
                  background: botAtivo === b ? '#e5e7eb' : 'transparent',
                  color: botAtivo === b ? '#000' : '#fff'
                }}
              >
                {b}
              </button>
            ))}
          </div>

          <p style={styles.instanciaText}>INSTÂNCIA: {botAtivo}</p>
        </div>

        {/* CONTROLE */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Controle</h3>
          <button
            onClick={toggleBot}
            style={{
              ...styles.playButton,
              borderColor: botLigado ? '#ef4444' : '#fff',
              background: botLigado ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)'
            }}
          >
            {botLigado ? '⏹' : '▶'}
          </button>
          <p style={styles.playLabel}>{botLigado ? `${botAtivo} em execução...` : 'Clique para iniciar'}</p>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={styles.stat}>
            <div style={styles.statTitle}>Entradas</div>
            <div style={styles.statValue}>{stats.entradas}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statTitle}>Na Fila</div>
            <div style={{ ...styles.statValue, color: '#22c55e' }}>{stats.na_fila}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statTitle}>Partidas</div>
            <div style={{ ...styles.statValue, color: '#a855f7' }}>{stats.partidas}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statTitle}>DMs</div>
            <div style={{ ...styles.statValue, color: '#06b6d4' }}>{stats.dms}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statTitle}>Uptime</div>
            <div style={{ ...styles.statValue, color: '#facc15' }}>{formatUptime()}</div>
          </div>
        </div>

        <button onClick={resetStats} style={styles.resetBtn}>RESETAR STATS</button>

        {/* CONFIGURAÇÃO */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Configuração</h3>

          <label style={styles.label}>Tokens</label>
          <textarea ref={tokensRef} rows={3} placeholder="Cole seus tokens aqui" style={styles.input} />
          {tokenError && <div style={styles.errorMsg}>{tokenError}</div>}

          <label style={styles.label}>Mensagem Automática</label>
          <input type="text" ref={mensagemRef} placeholder="Mensagem para enviar" style={styles.input} />

          <label style={styles.label}>Intervalo de Scan (segundos)</label>
          <input type="number" ref={intervalRef} defaultValue={12} min={2} max={60} style={styles.input} />

          <label style={styles.label}>Seleção de Alvos</label>
          <div style={styles.cascata}>
            {CATEGORIES.map(cat => (
              <div key={cat} style={styles.catGroup}>
                <div style={styles.catHeader}>{cat}</div>
                <div style={styles.modesGrid}>
                  {MODES.map(mod => (
                    <div key={mod}>
                      <div style={styles.modHeader}>{mod}</div>
                      {GELOS.map(gel => (
                        <label key={gel} style={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selections[cat][mod][gel]}
                            onChange={() => handleCheckboxChange(cat, mod, gel)}
                            style={styles.checkbox}
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

          <button onClick={salvarConfiguracao} disabled={isSaving} style={styles.saveBtn}>
            {isSaving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÃO'}
          </button>
          {configMessage && <div style={styles.successMsg}>{configMessage}</div>}
        </div>

        {/* LOGS */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Logs</h3>
          <div ref={logsRef} style={styles.logs}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.type === 'success' ? '#22c55e' : log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#facc15' : '#22d3ee' }}>
                {log.message}
              </div>
            ))}
          </div>
          <button onClick={limparLogs} style={{ ...styles.resetBtn, marginTop: '12px' }}>LIMPAR LOGS</button>
        </div>
      </div>

      {/* TOAST */}
      {toast.visible && (
        <div style={{
          ...styles.toast,
          background: toast.type === 'success' ? '#16a34a' : toast.type === 'error' ? '#dc2626' : '#1d4ed8',
          opacity: toast.visible ? 1 : 0,
          transform: toast.visible ? 'translateY(0)' : 'translateY(80px)'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const styles: any = {
  app: {
    margin: 0,
    padding: 0,
    fontFamily: 'Arial, sans-serif',
    background: '#050c1f',
    color: '#e5e7eb',
    minHeight: '100vh',
    width: '100%'
  },
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '15px',
    boxSizing: 'border-box'
  },
  card: {
    background: '#0b1f47',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    boxSizing: 'border-box'
  },
  header: {
    textAlign: 'center' as const
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 5px 0'
  },
  subtitle: {
    fontSize: '12px',
    opacity: 0.6,
    margin: 0
  },
  status: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '15px',
    flexWrap: 'wrap' as const
  },
  badge: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
    border: 'none'
  },
  botTabs: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    justifyContent: 'center'
  },
  botTab: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  instanciaText: {
    fontSize: '12px',
    opacity: 0.6,
    margin: '10px 0 0 0'
  },
  cardTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px'
  },
  playButton: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    border: '3px solid',
    fontSize: '40px',
    cursor: 'pointer',
    display: 'block',
    margin: '20px auto',
    background: 'rgba(255,255,255,0.03)',
    color: '#fff'
  },
  playLabel: {
    textAlign: 'center' as const,
    fontSize: '14px',
    margin: 0
  },
  stat: {
    background: '#020617',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)'
  },
  statTitle: {
    fontSize: '12px',
    opacity: 0.6
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginTop: '5px'
  },
  resetBtn: {
    width: '100%',
    padding: '12px',
    marginBottom: '20px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 80, 80, 0.4)',
    background: 'rgba(255, 80, 80, 0.08)',
    color: '#ff5a5a',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px'
  },
  label: {
    display: 'block',
    marginTop: '15px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    opacity: 0.85
  },
  input: {
    width: '100%',
    padding: '12px',
    marginTop: '6px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.07)',
    background: '#020617',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    fontFamily: 'Arial, sans-serif'
  },
  errorMsg: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    marginTop: '8px'
  },
  cascata: {
    background: '#020617',
    borderRadius: '8px',
    padding: '10px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
    marginTop: '8px',
    border: '1px solid rgba(255,255,255,0.06)'
  },
  catGroup: {
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '1px solid #1e3a8a'
  },
  catHeader: {
    color: '#3b82f6',
    fontWeight: 'bold',
    marginBottom: '10px',
    fontSize: '13px',
    textTransform: 'uppercase' as const
  },
  modesGrid: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: '10px'
  },
  modHeader: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: '5px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    marginBottom: '4px'
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  saveBtn: {
    width: '100%',
    padding: '14px',
    marginTop: '20px',
    border: 'none',
    borderRadius: '8px',
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer'
  },
  successMsg: {
    background: 'rgba(34,211,238,0.1)',
    border: '1px solid rgba(34,211,238,0.3)',
    color: '#22d3ee',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    marginTop: '10px'
  },
  logs: {
    background: '#000',
    padding: '12px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    height: '200px',
    overflowY: 'auto' as const,
    border: '1px solid rgba(255,255,255,0.05)'
  },
  toast: {
    position: 'fixed' as const,
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 'bold',
    zIndex: 9999,
    transition: 'all 0.3s ease'
  }
};

export default App;
