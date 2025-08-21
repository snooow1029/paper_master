# Paper Master - Academic Paper Visualization Tool

An interactive academic paper visualization tool similar to Connected Papers, enabling users to input multiple paper URLs and generate editable connection graphs with AI-powered relationship analysis.

## Project Overview

Paper Master is designed to help researchers visualize and understand the relationships between academic papers by automatically extracting citation networks and generating intelligent summaries of how papers connect to each other. The tool combines web with AI to create an interactive knowledge graph that grows with each analysis.

### Key Features

- **Multi-paper input** — Primary support for arXiv URLs. Other sources (DOI, publisher pages, local PDFs) are supported but may have reduced parsing fidelity depending on source metadata.
- **Selectable Analysis Depth** — Choose between a quick 1-level analysis (~3-5 mins) or a deep 2-level analysis (~15-20 mins) to control processing time.
- **Smart Section Filtering** — Focus analysis on specific sections like "Introduction" and "Related Work" for more relevant and targeted insights.
- **Intelligent relationship analysis** — Automatic extraction and analysis of citation and semantic relationships between papers. Edges are labeled and supplemented with confidence metadata produced via LLM-assisted parsing.
- **Interactive visualization** — Zoomable, draggable graph visualization (vis-network / D3) with node/edge selection, contextual detail panels, and client-side editing tools.
- **Real-time updates & curation** — Immediate UI updates for edits and deletions, plus backend hooks for longer-running analysis jobs.

## Demo

<video src="Demo.mp4" width="600" controls></video>

## Quick Start

This project uses a monorepo-like structure with a root `package.json` to manage both the frontend and backend.

### Prerequisites

- Node.js (>=16)
- npm or yarn
- Java (for GROBID)
- Git

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/snooow1029/paper_master.git
   cd paper-master
   ```
2. **Install all dependencies:**
   This command will install dependencies for the root, frontend, and backend packages.

   ```bash
   npm run install:all
   ```

### Running the Development Servers

This project requires three separate processes to run concurrently: the GROBID server, the backend API, and the frontend web app.

1. **Start GROBID (Terminal 1)**

   GROBID is used to extract structured metadata from PDFs. See the [GROBID documentation](https://grobid.readthedocs.io/en/latest/Introduction/) for more details.

   ```bash
   # Download and run GROBID (only needs to be done once)
   wget https://github.com/kermitt2/grobid/archive/0.8.2.zip
   unzip 0.8.2.zip
   cd grobid-0.8.2
   ./gradlew run
   ```

   By default, GROBID listens on `http://localhost:8070`.
2. **Configure and Start the Backend & Frontend (Terminal 2)**

   First, set up your environment variables by copying the example file:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Next, edit `backend/.env` to add your `OPENAI_API_KEY` or specify a local `VLLM_URL`.

   Finally, run the development script from the root directory. This will start both the backend and frontend servers concurrently.

   ```bash
   npm run dev
   ```

   - The **backend** will run on the port specified in `.env` (default: `5000`).
   - The **frontend** will run on `http://localhost:3000`.

### Quick Verification

1. Ensure GROBID is running.
2. Run `npm run dev` from the root directory.
3. Open your browser to `http://localhost:3000`.
4. Submit an arXiv URL and confirm that the analysis pipeline completes successfully.

## Current Status (v0.1 — Functional Prototype)

- **Input:** Supports single or multiple paper URL submission.
- **Processing:** Synchronous fetching and analysis of up to two levels of connected papers.
- **Core analysis:** Uses an LLM to generate descriptive text for edges based on in-text citations.
- **Output:** Renders a temporary graph visualization in the web UI.
- **Persistence:** Basic SQLite storage with TypeORM integration (results are currently limited in lifecycle).

## Development Roadmap

### Phase 1 — Foundational Enhancements

Objective: Transition from a prototype to a robust, scalable application.

- [ ] 1.1 Implement asynchronous task processing (e.g., Celery/Redis or a Node.js task queue) to avoid long HTTP request times.
- [ ] 1.2 Integrate a persistent graph database (e.g., Neo4j) for cumulative knowledge storage.
- [ ] 1.3 Upgrade UI/UX and input capabilities (multiple URL inputs, PDF uploads, progress feedback).

### Phase 2 — Core Features & Interactivity

Objective: Build interactive curation and integration features.

- [ ] 2.1 Implement "Second Brain" integration (Obsidian sync with Juggl/Dataview-compatible Markdown).

### Phase 3 — Advanced Features & Platformization

Objective: Evolve into a multi-user research platform.

- [ ] 3.1 User accounts and multi-tenancy.
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
