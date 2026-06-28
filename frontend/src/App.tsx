import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

// API URL - em produção usa mesma origem, em dev usa proxy do Vite
const API_URL = '';

interface LogEntry {
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

function App() {
  // Estado
  const [botAtivo, setBotAtivo] = useState('BOT1');
  const [botLigado, setBotLigado] = useState(false);
  const [conexao, setConexao] = useState(false);
  const [stats, setStats] = useState({ entradas: 0, na_fila: 0, partidas: 0, dms: 0 });
  const [logs, setLogs] = useState<{ time: string; message: string; type: string }[]>([]);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [configMessage, setConfigMessage] = useState('');

  // Refs para inputs
  const tokensRef = useRef<HTMLTextAreaElement>(null);
  const mensagemRef = useRef<HTMLInputElement>(null);
  const catMobileRef = useRef<HTMLInputElement>(null);
  const catEmuladorRef = useRef<HTMLInputElement>(null);
  const catMistoRef = useRef<HTMLInputElement>(null);
  const catTaticoRef = useRef<HTMLInputElement>(null);
  const modo1x1Ref = useRef<HTMLInputElement>(null);
  const modo2x2Ref = useRef<HTMLInputElement>(null);
  const modo3x3Ref = useRef<HTMLInputElement>(null);
  const modo4x4Ref = useRef<HTMLInputElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const uptimeRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Toast
  const showToast = useCallback((msg: string, tipo: string) => {
    setToastMsg(msg);
    setToastType(tipo);
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // Add log
  const addLog = useCallback((msg: string, tipo: string) => {
    setLogs(prev => {
      const next = [...prev, { time: '', message: msg, type: tipo }];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  // Verificar conexão
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_URL}/`);
        if (res.status === 200) setConexao(true);
        else setConexao(false);
      } catch {
        setConexao(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Atualizar status do bot
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_URL}/status/${botAtivo}`);
        const data = res.data;
        setBotLigado(data.is_running);
        if (data.stats) {
          setStats({
            entradas: data.stats.entradas || 0,
            na_fila: data.stats.na_fila || 0,
            partidas: data.stats.partidas || 0,
            dms: data.stats.dms || 0,
          });
        }
      } catch {
        // silencioso
      }
    };
    check();
    const interval = setInterval(check, 3000);
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
      } catch {
        // silencioso
      }
    };
    const interval = setInterval(fetch, 1000);
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

  // Mudar bot
  const mudarBot = (bot: string) => {
    if (bot === botAtivo) return;
    setBotAtivo(bot);
    setUptimeSeconds(0);
    addLog(`Instância trocada para ${bot}.`, 'info');
    showToast(`Trocado para ${bot}`, 'info');
  };

  // Toggle bot
  const toggleBot = async () => {
    if (!botLigado) {
      try {
        const res = await axios.post(`${API_URL}/start_bot/${botAtivo}`);
        if (res.data.status === 'success') {
          addLog(`✅ ${botAtivo} iniciado com sucesso.`, 'success');
          showToast(`${botAtivo} ligado!`, 'success');
          setUptimeSeconds(0);
        } else {
          addLog(`❌ Erro: ${res.data.message}`, 'error');
          showToast(res.data.message, 'error');
        }
      } catch {
        addLog('❌ Erro ao conectar com o servidor backend.', 'error');
        showToast('Erro de conexão!', 'error');
      }
    } else {
      try {
        const res = await axios.post(`${API_URL}/stop_bot/${botAtivo}`);
        if (res.data.status === 'success') {
          addLog(`⚠️ ${botAtivo} desligado.`, 'warn');
          showToast(`${botAtivo} desligado`, 'warn');
        } else {
          addLog(`❌ Erro: ${res.data.message}`, 'error');
        }
      } catch {
        addLog('❌ Erro ao conectar com o servidor backend.', 'error');
      }
    }
  };

  // Reset stats
  const resetStatsHandler = async () => {
    try {
      await axios.post(`${API_URL}/reset_stats/${botAtivo}`);
      setStats({ entradas: 0, na_fila: 0, partidas: 0, dms: 0 });
      setUptimeSeconds(0);
      addLog('⚠️ Stats resetados.', 'warn');
      showToast('Stats resetados!', 'warn');
    } catch {
      addLog('❌ Erro ao resetar stats.', 'error');
    }
  };

  // Validar tokens
  const validarTokens = (tokensText: string) => {
    const tokenList = tokensText.split('\n').map(t => t.trim()).filter(t => t);
    if (tokenList.length === 0) return { valid: false, message: 'Nenhum token fornecido' };
    const errors: string[] = [];
    tokenList.forEach((token, i) => {
      if (token.length < 59) errors.push(`Token ${i + 1}: muito curto`);
      else if (token.length > 100) errors.push(`Token ${i + 1}: muito longo`);
      else if (!/^[A-Za-z0-9_.-]+$/.test(token)) errors.push(`Token ${i + 1}: caracteres inválidos`);
    });
    if (errors.length > 0) return { valid: false, message: errors.join('; ') };
    return { valid: true, message: `${tokenList.length} token(s) válido(s)` };
  };

  // Salvar configuração
  const salvarConfiguracao = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setTokenError('');
    setConfigMessage('');

    try {
      const tokens = tokensRef.current?.value.trim() || '';
      const mensagem = mensagemRef.current?.value.trim() || '';

      const categorias: string[] = [];
      if (catMobileRef.current?.checked) categorias.push('Mobile');
      if (catEmuladorRef.current?.checked) categorias.push('Emulador');
      if (catMistoRef.current?.checked) categorias.push('Misto');
      if (catTaticoRef.current?.checked) categorias.push('Tático');

      const modos: string[] = [];
      if (modo1x1Ref.current?.checked) modos.push('1x1');
      if (modo2x2Ref.current?.checked) modos.push('2x2');
      if (modo3x3Ref.current?.checked) modos.push('3x3');
      if (modo4x4Ref.current?.checked) modos.push('4x4');

      const validation = validarTokens(tokens);
      if (!validation.valid) {
        setTokenError('❌ ' + validation.message);
        addLog(`❌ Erro: ${validation.message}`, 'error');
        showToast('Tokens inválidos!', 'error');
        setIsSaving(false);
        return;
      }

      const config = {
        bot_id: botAtivo,
        tokens,
        categories: categorias,
        mensagem,
        modos,
      };

      const res = await axios.post(`${API_URL}/save_config`, config);

      if (res.status === 200) {
        addLog(`✅ Configuração salva para ${botAtivo}`, 'success');
        showToast('Configuração salva!', 'success');
        setConfigMessage('✅ ' + res.data.message);
        setTimeout(() => setConfigMessage(''), 3000);
      } else {
        addLog(`❌ Erro: ${res.data.message}`, 'error');
        showToast('Erro ao salvar!', 'error');
      }
    } catch (err: any) {
      addLog(`❌ Erro de conexão: ${err.message}`, 'error');
      showToast('Erro de conexão!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Limpar logs
  const limparLogs = () => {
    setLogs([]);
    addLog('Logs limpos.', 'info');
  };

  // Formatação
  const formatUptime = () => {
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    const s = uptimeSeconds % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
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
              {botLigado ? 'Rodando' : 'Parado'}
            </div>
          </div>

          <div className="bot-tabs">
            <div className={botAtivo === 'BOT1' ? 'active' : ''} onClick={() => mudarBot('BOT1')}>BOT1</div>
            <div className={botAtivo === 'BOT2' ? 'active' : ''} onClick={() => mudarBot('BOT2')}>BOT2</div>
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
          <button className="reset-btn" onClick={resetStatsHandler}>RESETAR STATS</button>
        </div>

        {/* CONFIGURAÇÃO */}
        <div className="card">
          <h3>Configuração</h3>

          <label>Tokens</label>
          <textarea ref={tokensRef} rows={3} placeholder="Cole seus tokens aqui (um por linha)"></textarea>
          {tokenError && <div className="error-message">{tokenError}</div>}

          <label>Categorias</label>
          <div className="orgs-box">
            <label className="org-item">
              <input type="checkbox" ref={catMobileRef} defaultChecked />
              <span>Mobile</span>
            </label>
            <label className="org-item">
              <input type="checkbox" ref={catEmuladorRef} />
              <span>Emulador</span>
            </label>
            <label className="org-item">
              <input type="checkbox" ref={catMistoRef} />
              <span>Misto</span>
            </label>
            <label className="org-item">
              <input type="checkbox" ref={catTaticoRef} />
              <span>Tático</span>
            </label>
          </div>

          <label>Modos</label>
          <div className="orgs-box">
            <label className="org-item">
              <input type="checkbox" ref={modo1x1Ref} />
              <span>1x1</span>
            </label>
            <label className="org-item">
              <input type="checkbox" ref={modo2x2Ref} defaultChecked />
              <span>2x2</span>
            </label>
            <label className="org-item">
              <input type="checkbox" ref={modo3x3Ref} />
              <span>3x3</span>
            </label>
            <label className="org-item">
              <input type="checkbox" ref={modo4x4Ref} defaultChecked />
              <span>4x4</span>
            </label>
          </div>

          <label>Mensagem</label>
          <input type="text" ref={mensagemRef} placeholder="Digite a mensagem" />

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
                <span className={`log-time`}>{log.time}</span>
                <span className={`log-${log.type}`}>{log.message}</span>
              </div>
            ))}
          </div>
          <button className="clear-logs-btn" onClick={limparLogs}>Limpar Logs</button>
        </div>
      </div>

      {/* TOAST */}
      <div className={`toast ${toastVisible ? 'show' : ''} ${toastType}`}>
        {toastMsg}
      </div>
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// CSS completo do HTML original integrado ao React
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
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
}
.card.bot-ligado {
  border-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 10px 40px rgba(239,68,68,0.25), inset 0 0 40px rgba(0,0,0,0.5);
}
.header { text-align: center; }
.logo {
  width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 22px;
  background: linear-gradient(145deg, #1e3a8a, #1d4ed8);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  box-shadow: 0 0 25px rgba(59,130,246,0.4);
}
.logo img { width: 100%; height: 100%; object-fit: cover; }
.title { font-size: 26px; font-weight: 700; letter-spacing: 4px; }
.subtitle { opacity: 0.6; font-size: 13px; margin-top: 5px; }
.status { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
.badge { padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; transition: all 0.3s ease; }
.badge-green { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
.badge-red { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
.bot-tabs { display: flex; background: #091a36; border-radius: 30px; padding: 6px; margin-top: 15px; }
.bot-tabs div { flex: 1; text-align: center; padding: 10px; border-radius: 20px; cursor: pointer; transition: all 0.3s ease; font-weight: 600; user-select: none; }
.bot-tabs div:hover:not(.active) { background: rgba(255,255,255,0.07); }
.bot-tabs .active { background: #e5e7eb; color: #000; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.play-wrapper { display: flex; flex-direction: column; align-items: center; margin: 30px 0 10px; }
.play {
  width: 140px; height: 140px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.7);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all 0.35s ease; position: relative; background: rgba(255,255,255,0.03); user-select: none;
}
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
.reset-btn {
  width: 100%; padding: 14px; border-radius: 14px; border: 1px solid rgba(255, 80, 80, 0.4);
  background: rgba(255, 80, 80, 0.08); color: #ff5a5a; font-size: 15px; font-weight: 600;
  cursor: pointer; transition: all 0.25s ease; backdrop-filter: blur(6px); letter-spacing: 0.5px;
}
.reset-btn:hover { background: rgba(255, 80, 80, 0.18); border-color: rgba(255, 80, 80, 0.7); box-shadow: 0 0 15px rgba(255,80,80,0.2); }
.reset-btn:active { transform: scale(0.97); }
label { margin-top: 15px; display: block; font-size: 14px; font-weight: 500; opacity: 0.85; }
input, textarea, select {
  width: 100%; padding: 14px; margin-top: 6px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.07); background: #020617; color: #fff;
  font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box;
}
input:focus, textarea:focus, select:focus { border-color: rgba(34,211,238,0.4); }
.orgs-box {
  background: #020617; border-radius: 14px; padding: 10px 15px; max-height: 180px;
  overflow-y: auto; margin-top: 8px; border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 0 20px rgba(0,0,0,0.6);
}
.org-item { display: flex; align-items: center; gap: 12px; padding: 9px 5px; cursor: pointer; font-size: 15px; border-radius: 8px; transition: background 0.2s; }
.org-item:hover { background: rgba(255,255,255,0.04); }
.org-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #22d3ee; cursor: pointer; margin: 0; padding: 0; }
.org-item input:checked + span { color: #22d3ee; }
.save-btn {
  width: 100%; padding: 15px; margin-top: 20px; border: none; border-radius: 12px;
  background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #fff; font-weight: 700;
  font-size: 15px; cursor: pointer; letter-spacing: 0.5px; transition: all 0.25s ease;
  box-shadow: 0 4px 15px rgba(29,78,216,0.35);
}
.save-btn:hover { background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 6px 20px rgba(29,78,216,0.5); transform: translateY(-1px); }
.save-btn:active { transform: scale(0.98) translateY(0); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.logs {
  background: #000; padding: 15px; border-radius: 12px; font-family: 'Courier New', monospace;
  font-size: 13px; height: 200px; overflow-y: auto; line-height: 1.6; border: 1px solid rgba(255,255,255,0.05);
}
.logs::-webkit-scrollbar { width: 5px; }
.logs::-webkit-scrollbar-track { background: #000; }
.logs::-webkit-scrollbar-thumb { background: #1d4ed8; border-radius: 3px; }
.log-entry { margin: 2px 0; }
.log-time { color: #4b5563; margin-right: 6px; }
.log-info { color: #22d3ee; }
.log-success { color: #22c55e; }
.log-warn { color: #facc15; }
.log-error { color: #f87171; }
.clear-logs-btn {
  margin-top: 12px; width: 100%; padding: 12px; border-radius: 12px;
  border: 1px solid rgba(255,90,90,0.35); background: rgba(255,90,90,0.1);
  color: #ff5a5a; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s ease;
}
.clear-logs-btn:hover { background: rgba(255,90,90,0.2); border-color: rgba(255,90,90,0.6); box-shadow: 0 0 12px rgba(255,90,90,0.2); }
.clear-logs-btn:active { transform: scale(0.97); }
.toast {
  position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(80px);
  background: #1d4ed8; color: #fff; padding: 12px 24px; border-radius: 30px;
  font-size: 14px; font-weight: 600; box-shadow: 0 8px 25px rgba(0,0,0,0.5);
  z-index: 9999; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease;
  opacity: 0; white-space: nowrap;
}
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
