export interface BotConfig {
  botId: string;
  token: string;
  message: string;
  interval: number;
  categories: string[];
  modes: string[];
  value?: number;
  isRunning: boolean;
}

export interface BotStatus {
  is_running: boolean;
  status: string;
  stats: BotStats;
}

export interface BotStats {
  entradas: number;
  na_fila: number;
  partidas: number;
  dms: number;
  executions: number;
  serversProcessed: number;
  messagesProcessed: number;
  buttonsClicked: number;
  messagesSent: number;
  errors: number;
  lastExecution: string | null;
}

export interface LogEntry {
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  server?: string;
  channel?: string;
}

export interface SaveConfigRequest {
  bot_id: string;
  tokens: string;
  categories: string[];
  mensagem: string;
  modos: string[];
}
