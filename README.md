# SystemX - Automação Discord com Painel Web

Sistema completo de automação Discord com painel web integrado, pronto para deploy no Railway.

## Arquitetura

```
systemx/
├── src/                    # Backend (Express + TypeScript)
│   ├── automation/         # Módulo de automação Discord (selfbot-v13)
│   ├── config/             # Configuração (database)
│   ├── routes/             # Rotas da API
│   ├── services/           # Serviços (logs, stats, settings)
│   ├── types/              # Tipos TypeScript
│   └── index.ts            # Entry point do servidor
├── frontend/               # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── App.tsx         # Componente principal (HTML integrado)
│   │   ├── main.tsx        # Entry point React
│   │   └── index.css       # Tailwind CSS
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── prisma/                 # Schema e migrations do banco
│   ├── schema.prisma
│   └── migrations/
├── package.json            # Package principal
├── tsconfig.json           # Config TypeScript backend
├── railway.toml            # Config Railway
└── .env.example            # Variáveis de ambiente
```

## Stack

- **Backend:** Node.js + TypeScript + Express.js
- **Frontend:** React + Vite + TypeScript
- **Banco:** PostgreSQL + Prisma ORM
- **Automação:** discord.js-selfbot-v13
- **Deploy:** Railway (serviço único)

## Deploy no Railway

### 1. Criar projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Crie um novo projeto
3. Adicione um serviço **PostgreSQL** (addon)
4. Adicione um serviço a partir do **GitHub** ou faça upload do código

### 2. Variáveis de ambiente

No painel do Railway, configure:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | (fornecido automaticamente pelo addon PostgreSQL) |
| `PORT` | `8000` (ou deixe o Railway definir) |
| `NODE_ENV` | `production` |

### 3. Deploy

O Railway detectará automaticamente o `railway.toml` e executará:

1. `npm install` - Instala dependências
2. `npm run build` - Builda frontend + backend
3. `npx prisma migrate deploy` - Aplica migrations
4. `npm start` - Inicia o servidor

### 4. Acesso

Após o deploy, o Railway fornecerá uma URL pública (ex: `systemx-production.up.railway.app`).

O frontend será servido na raiz (`/`) e a API estará disponível em todas as rotas.

## Desenvolvimento Local

```bash
# 1. Instalar dependências
npm install
cd frontend && npm install && cd ..

# 2. Configurar .env
cp .env.example .env
# Edite .env com sua DATABASE_URL local

# 3. Aplicar migrations
npx prisma migrate dev

# 4. Iniciar em modo dev
npm run dev
```

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Health check |
| GET | `/status/:botId` | Status do bot |
| POST | `/start_bot/:botId` | Iniciar bot |
| POST | `/stop_bot/:botId` | Parar bot |
| GET | `/logs/:botId` | Obter logs |
| POST | `/save_config` | Salvar configuração |
| GET | `/settings/:botId` | Obter configuração |
| POST | `/reset_stats/:botId` | Resetar estatísticas |
| GET | `/stats/:botId` | Obter estatísticas |

## Fluxo da Automação

```
Frontend (React) → API Backend (Express) → PostgreSQL → Automação Discord
```

1. Usuário configura token, categorias e modos no painel
2. Clica em PLAY para iniciar
3. Backend inicia loop de automação com discord.js-selfbot-v13
4. Loop percorre servidores → canais → mensagens → botões
5. Clica em botões válidos e envia mensagens automáticas
6. Logs e stats são atualizados em tempo real
7. Frontend faz polling a cada 1-3s para atualizar interface
