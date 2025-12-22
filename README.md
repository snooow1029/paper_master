# Paper Master - Academic Paper Visualization Tool

An interactive academic paper visualization tool similar to Connected Papers, enabling users to input multiple paper URLs and generate editable connection graphs with AI-powered relationship analysis.

## Project Overview

Paper Master is a comprehensive academic paper visualization and analysis platform that helps researchers understand the relationships between academic papers through interactive knowledge graphs. It combines automated citation extraction, AI-powered relationship analysis, and seamless integration with knowledge management tools.

### Core Capabilities

Paper Master enables researchers to:

- **Visualize citation networks** — Build interactive, editable graphs showing relationships between papers with D3.js-based force-directed visualization
- **Extract citations intelligently** — Use GROBID to parse PDFs and extract structured citation data with deduplication and section filtering
- **Analyze relationships** — Leverage LLMs (local/Ollama, Gemini, or OpenAI) to understand how papers connect and relate to each other with detailed edge metadata
- **Search arXiv papers** — Integrated arXiv API search with intelligent relevance ranking and query normalization
- **Manage sessions** — Save and restore analysis sessions with persistent graph data (SQLite/PostgreSQL)
- **Export to Obsidian** — Seamlessly sync knowledge graphs to Obsidian vaults with complete edge information, supporting multiple export modes (local path, ZIP download, REST API)

### Key Features

- **Multi-paper input** — Primary support for arXiv URLs with fallback to other sources (DOI, publisher pages)
- **Selectable Analysis Depth** — Choose between quick 1-level (~3-5 mins) or deep 2-level analysis (~15-20 mins)
- **Smart Section Filtering** — Focus analysis on specific sections (Introduction, Related Work, etc.)
- **Intelligent relationship analysis** — AI-powered extraction of citation and semantic relationships
- **Interactive visualization** — D3.js-based force-directed graph with node/edge editing
- **Prior Works & Derivative Works** — Analyze papers that influenced or were influenced by your input
- **Citation Extractor** — Extract and format citations from PDFs with deduplication
- **arXiv Search** — Search arXiv papers with intelligent relevance ranking
- **Obsidian Integration** — Export knowledge graphs to Obsidian with complete edge information, supporting local path, ZIP download, and REST API sync modes

## Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Obsidian Integration](#obsidian-integration)
- [Project Structure](#project-structure)
- [Current Status](#current-status-v01-functional-prototype)
- [Development Roadmap](#development-roadmap)
- [Technical Architecture](#technical-architecture)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Contact](#contact)

## Prerequisites

### Required

- **Node.js** >= 16.x (recommended: 18.x or 20.x)
- **npm** >= 8.x or **yarn** >= 1.22.x
- **Java** >= 11 (for GROBID)
- **Git**

### Optional (for Local LLM Mode)

- **Ollama** — For running local LLMs ([Installation Guide](https://ollama.ai))
- **Python** >= 3.9 — For LiteLLM bridge
- **LiteLLM** — Install with `pip install litellm`

### Optional (for Production)

- **PostgreSQL** >= 12.x — For production database (SQLite is used by default)

## Installation

### 1. Clone the Repository

```bash
   git clone https://github.com/snooow1029/paper_master.git
   cd paper_master
```

### 2. Install Dependencies

Install dependencies for root, frontend, and backend:

```bash
   npm run install:all
```

This command will:

- Install root-level dependencies (concurrently)
- Install frontend dependencies (React, Vite, D3.js, etc.)
- Install backend dependencies (Express, TypeORM, etc.)

### 3. Download and Setup GROBID

GROBID is required for PDF parsing and citation extraction.

**Option A: Download and Extract (Recommended)**

```bash
# Download GROBID 0.8.2
wget https://github.com/kermitt2/grobid/archive/0.8.2.zip
unzip 0.8.2.zip

# Or use curl on macOS
curl -L -o grobid-0.8.2.zip https://github.com/kermitt2/grobid/archive/0.8.2.zip
unzip grobid-0.8.2.zip
```

**Option B: Use Docker (Alternative)**

```bash
docker run --rm -d -p 8070:8070 lfoppiano/grobid:0.8.2
```

**Option C: Clone from GitHub**

```bash
git clone --branch 0.8.2 --depth 1 https://github.com/kermitt2/grobid.git grobid-0.8.2
cd grobid-0.8.2
chmod +x gradlew
```

The GROBID directory should be located at `./grobid-0.8.2` in the project root.

## Configuration

### Environment Variables

The backend requires a `.env` file for configuration. A template is provided as `.env.example`.

#### 1. Copy the Example File

```bash
cp backend/.env.example backend/.env
```

#### 2. Configure Environment Variables

Edit `backend/.env` with your settings:

```bash
# Server Configuration
PORT=5001                    # Backend server port (default: 5001 or 8080)

# LLM Provider Configuration
# Options: 'local', 'gemini', 'openai', 'disabled'
LLM_TYPE=local               # Use 'local' for Ollama, 'gemini' for Google Gemini, 'disabled' to skip LLM features

# Local LLM Configuration (when LLM_TYPE=local)
LOCAL_LLM_URL=http://localhost:8000
LOCAL_LLM_MODEL=ollama/qwen2.5:3b-instruct

# Gemini API Configuration (when LLM_TYPE=gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI API Configuration (when LLM_TYPE=openai)
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
# For SQLite (default, no configuration needed):
# Leave DATABASE_URL empty or unset

# For PostgreSQL (production):
DATABASE_URL=postgresql://user:password@localhost:5432/paper_master
DB_SSL=false                  # Set to 'true' for SSL connections

# GROBID Service
GROBID_URL=http://localhost:8070

# OAuth Configuration (Optional, for Google OAuth login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5001/api/auth/google/callback

# JWT Secret (for authentication)
JWT_SECRET=your_jwt_secret_key_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### Environment Variable Reference

| Variable                 | Required | Default                        | Description                                                     |
| ------------------------ | -------- | ------------------------------ | --------------------------------------------------------------- |
| `PORT`                 | No       | `5001`                       | Backend server port                                             |
| `LLM_TYPE`             | No       | `disabled`                   | LLM provider:`local`, `gemini`, `openai`, or `disabled` |
| `LOCAL_LLM_URL`        | Yes*     | `http://localhost:8000`      | LiteLLM bridge URL (required if `LLM_TYPE=local`)             |
| `LOCAL_LLM_MODEL`      | Yes*     | `ollama/qwen2.5:3b-instruct` | Model identifier (required if `LLM_TYPE=local`)               |
| `GEMINI_API_KEY`       | Yes*     | -                              | Google Gemini API key (required if `LLM_TYPE=gemini`)         |
| `OPENAI_API_KEY`       | Yes*     | -                              | OpenAI API key (required if `LLM_TYPE=openai`)                |
| `DATABASE_URL`         | No       | -                              | PostgreSQL connection string (uses SQLite if not set)           |
| `DB_SSL`               | No       | `false`                      | Enable SSL for PostgreSQL                                       |
| `GROBID_URL`           | No       | `http://localhost:8070`      | GROBID service URL                                              |
| `GOOGLE_CLIENT_ID`     | No       | -                              | Google OAuth client ID                                          |
| `GOOGLE_CLIENT_SECRET` | No       | -                              | Google OAuth client secret                                      |
| `JWT_SECRET`           | No       | -                              | Secret key for JWT tokens                                       |
| `FRONTEND_URL`         | No       | `http://localhost:3000`      | Frontend URL for CORS                                           |

\* Required based on `LLM_TYPE` selection

### Frontend Environment Variables

The frontend uses Vite environment variables. Create `frontend/.env` if needed:

```bash
# Frontend API Base URL (optional, uses proxy in development)
VITE_API_BASE_URL=http://localhost:5001
```

**Note:** In development mode, the frontend uses a Vite proxy (configured in `vite.config.ts`) to forward `/api/*` requests to the backend. You typically don't need to set `VITE_API_BASE_URL` in development.

## Running the Application

### Method 1: One-Command Startup (macOS/Linux) — Recommended

The `run.sh` script automatically starts all required services:

```bash
./run.sh
```

This script will:

1. Load environment variables from `backend/.env`
2. Start Ollama (if `LLM_TYPE=local`)
3. Start LiteLLM bridge (if `LLM_TYPE=local`)
4. Start GROBID server
5. Install dependencies if needed
6. Start backend and frontend servers

**Customizing LLM Type:**

```bash
# Use local LLM (Ollama + LiteLLM)
LLM_TYPE=local ./run.sh

# Use Gemini API
LLM_TYPE=gemini ./run.sh

# Disable LLM features
LLM_TYPE=disabled ./run.sh
```

**Note:** Make sure `run.sh` is executable:

```bash
chmod +x run.sh
```

### Method 2: Manual Startup (All Platforms)

#### Step 1: Start GROBID

**Terminal 1 — GROBID:**

```bash
   cd grobid-0.8.2
   chmod +x gradlew
   ./gradlew run
```

GROBID will start on `http://localhost:8070`. Wait until you see:

```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8070
```

**Verification:**

```bash
curl http://localhost:8070/api/isalive
# Should return: true
```

#### Step 2: Start Local LLM Services (if using `LLM_TYPE=local`)

**Terminal 2 — Ollama:**

```bash
ollama serve
```

**Terminal 3 — LiteLLM Bridge:**

```bash
litellm --model ollama/qwen2.5:3b-instruct --api_base http://127.0.0.1:11435 --host 127.0.0.1 --port 8000
```

**Note:** Make sure you have a model installed in Ollama:

```bash
ollama pull qwen2.5:3b-instruct
```

#### Step 3: Start Backend and Frontend

**Option A: Concurrent Start (Recommended)**

**Terminal 4 — Both Services:**

```bash
   npm run dev
```

This starts both backend and frontend concurrently.

**Option B: Separate Terminals**

**Terminal 4 — Backend:**

```bash
cd backend
npm run dev
```

**Terminal 5 — Frontend:**

```bash
cd frontend
npm run dev
```

### Method 3: Windows PowerShell Scripts

**Terminal 1 — Backend:**

```powershell
.\start-backend.ps1
```

**Terminal 2 — Frontend:**

```powershell
.\start-frontend.ps1
```

**Note:** You still need to start GROBID separately (see Step 1 above).

### Verification

Once all services are running:

1. **Backend Health Check:**

   ```bash
   curl http://localhost:5001/api/health
   ```
2. **Frontend:**
   Open your browser to `http://localhost:3000`
3. **GROBID:**

   ```bash
   curl http://localhost:8070/api/isalive
   ```

## Obsidian Integration

Paper Master supports seamless integration with [Obsidian](https://obsidian.md/), allowing you to export knowledge graphs directly into your Obsidian vault. Exported files include complete edge information (relationship type, strength, context, explanation) and are compatible with Obsidian's native graph view and plugins like [Juggl](https://github.com/HEmile/juggl) and [Dataview](https://github.com/MichaelAquilina/zettelkasten).

### Export Modes

Three sync modes are available:

1. **Local Path** — Direct file system access (development)
   - Enter your Obsidian vault path and optional subfolder
   - Files are written directly to `Papers/` and `Paper_Graphs/` folders

2. **ZIP Download** — For production deployments
   - Downloads a ZIP file with the same folder structure
   - Extract to your Obsidian vault root directory

3. **REST API** — Automatic sync via [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin
   - Requires Obsidian running with the plugin installed
   - Enter API URL (default: `http://127.0.0.1:27123`) and API key
   - Files are automatically written to your vault

### File Format

Each exported paper file includes:
- **Frontmatter**: Title, authors, year, venue, arXiv ID, DOI, tags
- **Content**: Abstract, introduction, citation links with complete edge metadata
- **Links**: Uses Obsidian's `[[wikilinks]]` format for automatic graph connections

### Usage Tips

- **Graph View**: Open Obsidian's graph view (`Ctrl+G` / `Cmd+G`) to see paper relationships
- **Juggl Plugin**: Install for interactive graph visualization
- **Dataview**: Query papers using Dataview syntax (e.g., `TABLE authors, year FROM "Papers"`)
- **Subfolders**: Use optional subfolders to organize papers by project or topic
- **Updates**: Re-syncing overwrites existing files, allowing incremental updates

### Troubleshooting

- **REST API 404**: Ensure Obsidian is running and the Local REST API plugin is enabled
- **Files not appearing**: Check vault path (Local/ZIP) or Obsidian console (REST API)
- **Graph not showing connections**: Verify `[[wikilinks]]` are present and refresh Obsidian

## Project Structure

```
paper_master/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── entities/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── styles/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   └── package.json
├── shared/
│   ├── types/
│   └── utils/
├── grobid-0.8.2/
├── package.json
├── run.sh
├── start-backend.ps1
├── start-frontend.ps1
├── vercel.json
├── railway.json
└── nixpacks.toml
```

## Current Status (v0.1 — Functional Prototype)

### Implemented Features

- **Input:** Supports single or multiple paper URL submission with primary support for arXiv URLs
- **Processing:** Asynchronous task processing with progress tracking and real-time updates via Server-Sent Events (SSE)
- **Core Analysis:** Uses LLM (local/Ollama, Gemini, or OpenAI) to generate descriptive text for edges based on in-text citations
- **Graph Visualization:** Interactive D3.js-based force-directed graph with node/edge editing, selection, and persistent highlighting
- **Citation Extraction:** GROBID-powered citation extraction with deduplication and section filtering
- **Prior Works & Derivative Works:** Analyze papers that influenced or were influenced by input papers with citation count enrichment
- **arXiv Search:** Integrated arXiv API search with intelligent relevance ranking and query normalization
- **Session Management:** Save and restore analysis sessions with persistent graph data (SQLite/PostgreSQL)
- **Obsidian Integration:** Export knowledge graphs to Obsidian vaults with Juggl/Dataview-compatible Markdown format
- **OAuth Authentication:** Google OAuth login support for user accounts
- **Database:** SQLite (default) and PostgreSQL support with TypeORM automatic schema synchronization

### Current Limitations

- Task queue is in-memory (not persisted across server restarts)
- No graph database integration (Neo4j) for advanced graph analytics
- Synchronous processing still used for some operations (citation extraction)
- Limited scalability for large-scale analysis jobs

## Development Roadmap

### Phase 1 — Foundational Enhancements

Objective: Transition from a prototype to a robust, scalable application.

- [x] 1.1 Implement asynchronous task processing (e.g., Celery/Redis or a Node.js task queue) to avoid long HTTP request times.
  - Status: Completed (basic in-memory task queue with SSE progress updates implemented)
  - Future work: Persistent task queue with Redis/BullMQ for production scalability
- [ ] 1.2 Integrate a persistent graph database (e.g., Neo4j) for cumulative knowledge storage.
- [x] 1.3 Upgrade UI/UX and input capabilities (multiple URL inputs, PDF uploads, progress feedback).
  - Completed: Multiple URL inputs supported, progress feedback via SSE implemented
  - Partial: PDF uploads (GROBID supports PDF processing via URL)

### Phase 2 — Core Features & Interactivity

Objective: Build interactive curation and integration features.

- [x] 2.1 Implement "Second Brain" integration (Obsidian sync with Juggl/Dataview-compatible Markdown).
  - Status: Completed (ObsidianSyncService implemented with Markdown export and Juggl/Dataview-compatible format support)

### Phase 3 — Advanced Features & Platformization

Objective: Evolve into a multi-user research platform.

- [x] 3.1 User accounts and multi-tenancy.
  - Completed: Google OAuth authentication implemented, session-based user management
  - In progress: Full multi-tenancy isolation
- [ ] 3.2 Advanced graph analytics (PageRank, centrality, shortest-paths, community detection).
- [ ] 3.3 Intelligent recommendation system based on users' knowledge graphs.

## Technical Architecture

This repository contains a React + TypeScript frontend and a Node.js + TypeScript backend using Express and TypeORM. Key directories:

- `frontend/` — Vite + React app (vis-network / D3 for visualization).
- `backend/` — Express API, TypeORM entities, services for ingestion and analysis.
- `shared/` — shared types and utilities.

### Frontend (high level)

- Entry point: `frontend/src/main.tsx` and `frontend/src/App.tsx`.
- Pages: `frontend/src/pages/`.
- Components: `frontend/src/components/` (graph UI, panels, forms).
- Key dependencies: `react`, `react-dom`, `vite`, `@mui/material`, `tailwindcss`, `vis-network`, `d3`, `axios`, `zustand`.

### Backend (high level)

- Entry point: `backend/src/index.ts`.
- Routes, controllers, and services under `backend/src/`.
- Entities defined for TypeORM under `backend/src/entities/`.
- Key dependencies: `express`, `cors`, `dotenv`, `axios`, `sqlite3`, `typeorm`, `openai`.

## Contributing

If you'd like to contribute, please open an issue or submit a pull request. For development, follow the Quick Start steps above and run linters/tests before creating a PR.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [GROBID](https://github.com/kermitt2/grobid) — PDF parsing and citation extraction
- [D3.js](https://d3js.org/) — Graph visualization
- [TypeORM](https://typeorm.io/) — Database ORM
- [Ollama](https://ollama.ai/) — Local LLM runtime
- [LiteLLM](https://github.com/BerriAI/litellm) — LLM proxy

## Contact

- **GitHub:** [snooow1029/paper_master](https://github.com/snooow1029/paper_master)
- **Issues:** [GitHub Issues](https://github.com/snooow1029/paper_master/issues)

---
