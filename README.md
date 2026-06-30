# QueryMind 🧠

**AI-powered Text-to-SQL Analytics Platform** — Ask your database anything in plain English and get live results, charts, and plain-English SQL explanations.

---

## Features

- 🔐 **Supabase Authentication** — Google OAuth / email sign-in
- 🗄️ **Multi-Database Support** — PostgreSQL, MySQL, SQLite (file upload)
- 🤖 **Dual AI Provider** — Google Gemini 2.5 Flash or local Ollama models
- 📊 **Automatic Charts** — Bar, line, pie, area charts recommended by the backend
- 💬 **Chat-style Console** — Multi-turn query sessions with history
- 🔍 **SQL Explanation Panel** — Plain-English breakdown of every generated query
- 🌗 **Light / Dark Mode** — Premium beige light theme and deep crimson dark theme
- 🛡️ **SQL Injection Protection** — Allowlist validation, SELECT-only enforcement

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, Recharts |
| Backend | FastAPI, SQLAlchemy, LangChain |
| AI | Google Gemini 2.5 Flash, Ollama (local) |
| Auth & DB | Supabase (PostgreSQL) |
| Connectors | PostgreSQL, MySQL, SQLite |

---

## Project Structure

```
QueryMind/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/      # UI components (ResultsPanel, HistoryPage, …)
│       ├── hooks/           # useAuth
│       └── lib/             # api.js
├── server/                  # FastAPI backend
│   ├── connectors/          # DB connectors (postgres, mysql, sqlite)
│   ├── models/              # SQLAlchemy ORM models
│   ├── routers/             # API route handlers
│   ├── schemas/             # Pydantic request/response schemas
│   └── services/            # Business logic (sql_explainer, chart_recommender, …)
├── sql/                     # Schema setup scripts
├── .env.example             # Environment variable template
└── requirements.txt         # Root Python deps (legacy)
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Supabase project (free tier works)
- Google Gemini API key **or** Ollama running locally

### 1. Clone & configure

```bash
git clone https://github.com/YOUR_USERNAME/QueryMind.git
cd QueryMind

# Copy the env template and fill in your values
cp .env.example .env
```

Edit `.env`:

```env
# Supabase metadata DB
DB_HOST=your-project.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password

# Fernet encryption key for stored DB passwords
ENCRYPTION_KEY=your-fernet-key

# Supabase Auth JWT secret
SUPABASE_JWT_SECRET=your-jwt-secret

# Gemini
GOOGLE_API_KEY=your-gemini-api-key

# Ollama (optional — local models)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:1.5b
```

### 2. Backend

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Swagger docs at `/docs`.

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Supabase PostgreSQL host |
| `DB_PASSWORD` | Supabase DB password |
| `ENCRYPTION_KEY` | Fernet key for encrypting stored passwords |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `OLLAMA_HOST` | Ollama base URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Ollama model name |
| `AUTH_REQUIRED` | Set `true` in production; `false` for local dev |

---

## Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.

---

## License

MIT
