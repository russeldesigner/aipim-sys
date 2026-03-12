# 🚀 Guia de Instalação — Aipim de Tinguá Sys

---

## OPÇÃO A — Instalação Local (desenvolvimento / teste)

### Pré-requisitos
- Python 3.11 ou superior
- pip atualizado

### Passo a passo

```bash
# 1. Extrair o ZIP e entrar na pasta
unzip aipim_sys_v5.zip
cd aipim_sys_v2

# 2. Criar ambiente virtual (recomendado)
python -m venv .venv
source .venv/bin/activate        # Linux / Mac
.venv\Scripts\activate           # Windows

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env e troque o SECRET_KEY por uma string aleatória longa
# Deixe DATABASE_URL como sqlite:////data/aipim_sys.db para teste local

# 5. Inicializar banco de dados
flask db upgrade       # aplica migrations
# (na primeira execução o seed é aplicado automaticamente)

# 6. Iniciar
python run.py
```

Acesse: **http://localhost:5000**

---

## OPÇÃO B — Deploy no Render (produção, gratuito)

### Pré-requisitos
- Conta no [GitHub](https://github.com) (gratuito)
- Conta no [Render](https://render.com) (gratuito)

### Passo 1 — Subir no GitHub

```bash
cd aipim_sys_v2
git init
git add .
git commit -m "🌿 Aipim Sys v5"

# Crie um repositório no github.com chamado "aipim-sys"
git remote add origin https://github.com/SEU-USUARIO/aipim-sys.git
git branch -M main
git push -u origin main
```

### Passo 2 — Deploy automático via render.yaml

1. Acesse [render.com](https://render.com) → **New + → Blueprint**
2. Conecte o repositório `aipim-sys`
3. O Render lê o `render.yaml` automaticamente e cria:
   - Web Service Python
   - Banco PostgreSQL gratuito
   - Variáveis de ambiente (SECRET_KEY gerado automaticamente)
4. Clique **Apply** — em ~3 minutos o sistema estará online

> O `render.yaml` já configura tudo: PostgreSQL, `FLASK_APP`, migrations automáticas no build.

### Passo 3 — Primeiro acesso

Abra a URL pública gerada pelo Render (ex: `https://aipim-sys.onrender.com`)

O banco é populado automaticamente com usuários e produtos padrão na primeira execução.

---

## OPÇÃO C — Deploy manual no Render (sem Blueprint)

1. **Render → New + → Web Service**
2. Conecte o repositório GitHub
3. Configure:
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt && flask db upgrade`
   - **Start Command:** `gunicorn run:app --workers 2 --timeout 60`
4. Em **Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `SECRET_KEY` | clique em "Generate" |
   | `FLASK_ENV` | `production` |
   | `FLASK_APP` | `run.py` |
   | `DATABASE_URL` | criado automaticamente pelo banco abaixo |

5. Em **New + → PostgreSQL**, crie um banco chamado `aipim-db` (plano Free)
6. Copie a **Internal Connection String** do banco para `DATABASE_URL` no Web Service

---

## Migrations — atualizar o banco após mudanças no models.py

```bash
# Após alterar models.py:
flask db migrate -m "descricao da mudanca"
flask db upgrade

# Em produção (Render): basta fazer push — o build roda flask db upgrade automaticamente
```

---

## Credenciais padrão

| Perfil | Email | Senha |
|---|---|---|
| 👑 Administrador | admin@aipim.com | admin123 |
| 📋 Gestor Operacional | gestor@aipim.com | gest123 |
| 🚚 Gestor Logística | glog@aipim.com | logist123 |
| 🏭 Op. Galpão | galp@aipim.com | galp123 |
| 🍳 Op. Cozinha | coz@aipim.com | coz123 |
| 🚛 Op. Logística | log@aipim.com | log123 |

> ⚠️ **Troque todas as senhas após o primeiro login em produção.**

---

## Acessar pelo celular (PWA)

O sistema é responsivo e funciona como app instalável:

- **Android (Chrome):** Menu ⋮ → "Adicionar à tela inicial"
- **iPhone (Safari):** Compartilhar ↑ → "Adicionar à Tela de Início"

---

## Estrutura do projeto

```
aipim_sys_v2/
├── run.py                  ← ponto de entrada
├── Procfile                ← comando Gunicorn (Heroku/Railway)
├── render.yaml             ← deploy automático no Render
├── requirements.txt        ← dependências Python
├── .env.example            ← variáveis de ambiente (copiar → .env)
├── migrations/             ← Flask-Migrate / Alembic
│   ├── env.py
│   ├── script.py.mako
│   └── versions/           ← arquivos de migration gerados
├── app/
│   ├── __init__.py         ← factory Flask, cookies seguros, headers
│   ├── models.py           ← SQLAlchemy (Numeric, UniqueConstraint)
│   └── routes/
│       ├── auth.py         ← login/logout + rate limiting
│       ├── main.py         ← páginas + contexto JS
│       └── api.py          ← 21 endpoints REST validados
├── templates/
│   ├── login.html
│   └── app.html
└── static/
    ├── css/app.css
    └── js/app.js
```

---

## Solução de problemas

| Sintoma | Causa | Solução |
|---|---|---|
| `flask db upgrade` falha | `FLASK_APP` não definido | `export FLASK_APP=run.py` |
| Erro 500 no login | `SECRET_KEY` não configurado | Definir no `.env` |
| Banco vazio após deploy | Migrations não rodaram | Verificar Build Command no Render |
| Cookie não persiste | HTTP em vez de HTTPS | Usar HTTPS em produção (`FLASK_ENV=production`) |
| `psycopg2` error | Driver PostgreSQL ausente | `pip install psycopg2-binary` |
