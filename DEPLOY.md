# 🚀 Guia de Deploy — Aipim de Tinguá Sys

## Pré-requisitos
- Python 3.11+
- Git instalado
- Conta no [GitHub](https://github.com) (gratuito)
- Conta no [Render](https://render.com) (gratuito)

---

## 1. Testar localmente

```bash
cd aipim_sys

# Instalar dependências
pip install -r requirements.txt

# Copiar arquivo de configuração
cp .env.example .env
# Edite o .env e troque o SECRET_KEY

# Rodar
python run.py
```
Acesse: http://localhost:5000

---

## 2. Subir no GitHub

```bash
cd aipim_sys
git init
git add .
git commit -m "🌿 Aipim Sys - versão inicial"

# Crie um repositório no github.com chamado "aipim-sys"
git remote add origin https://github.com/SEU-USUARIO/aipim-sys.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy no Render (gratuito)

1. Acesse [render.com](https://render.com) → **New + → Web Service**
2. Conecte seu repositório GitHub `aipim-sys`
3. Configure:
   - **Name:** `aipim-sys`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn run:app`
4. Em **Environment Variables**, adicione:
   - `SECRET_KEY` → clique em "Generate" para criar automaticamente
   - `FLASK_ENV` → `production`
5. Em **Disk** → Add Disk:
   - Name: `aipim-db`
   - Mount Path: `/data`
   - Size: 1 GB
6. Clique **Create Web Service**

> ✅ Em ~3 minutos o sistema estará online com URL pública.

---

## 4. Configurar o banco no Render

Após o primeiro deploy, adicione esta variável de ambiente:
```
DATABASE_URL = sqlite:////data/aipim_sys.db
```
Isso salva o banco no disco persistente do Render.

---

## 5. Acessar pelo celular

O sistema já é responsivo. Basta abrir a URL do Render no navegador do celular.

**Para instalar como app (PWA):**
- **Android (Chrome):** Menu → "Adicionar à tela inicial"
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início"

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

> ⚠️ Troque as senhas após o primeiro login em produção!

---

## Estrutura do projeto

```
aipim_sys/
├── run.py              ← ponto de entrada
├── Procfile            ← comando para Render/Heroku
├── render.yaml         ← configuração automática do Render
├── requirements.txt    ← dependências Python
├── .env.example        ← variáveis de ambiente (copiar para .env)
├── app/
│   ├── __init__.py     ← factory Flask + seed do banco
│   ├── models.py       ← modelos SQLAlchemy
│   └── routes/
│       ├── auth.py     ← login/logout
│       ├── main.py     ← páginas principais
│       └── api.py      ← API REST completa
├── templates/
│   ├── login.html      ← tela de login responsiva
│   └── app.html        ← app principal responsivo
└── static/
    ├── css/app.css     ← estilos mobile-first
    └── js/app.js       ← lógica frontend
```

---

## Próximos passos sugeridos

- [ ] Trocar senhas padrão
- [ ] Configurar domínio próprio no Render (ex: `sistema.aipimdetingua.com.br`)
- [ ] Ativar HTTPS (automático no Render)
- [ ] Fazer backup semanal do banco SQLite
- [ ] Adicionar módulo DRE e Fluxo de Caixa





d7d7fefba2ccdff41d3dc422cc8419b6
