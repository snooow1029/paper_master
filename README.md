# Paper Master - Academic Paper Visualization Tool

An interactive academic paper visualization tool similar to Connected Papers, enabling users to input multiple paper URLs and generate editable connection graphs with AI-powered relationship analysis.

## Project Overview

Paper Master is designed to help researchers visualize and understand the relationships between academic papers by automatically extracting citation networks and generating intelligent summaries of how papers connect to each other. The tool combines modern web technologies with AI to create an interactive knowledge graph that grows with each analysis.

### Key Features

- 📝 **Multi-Paper Input**: Support for arXiv, DOI, and other academic paper URLs
- 🔗 **Intelligent Relationship Analysis**: Automatic analysis of paper connections and citations
- 🎨 **Interactive Visualization**: Draggable, editable paper connection graphs using vis.js/D3.js
- 🤖 **AI-Powered Summaries**: LLM-generated relationship descriptions and insights
- ⚡ **Real-time Updates**: Dynamic addition, editing, and deletion of nodes and edges
- 💾 **Persistent Storage**: SQLite database for storing analysis results

## Current Status (v0.1 - Functional Prototype)

- **Input:** Supports single paper URL submission
- **Processing:** Synchronously fetches and analyzes up to 2 levels of connected papers
- **Core Analysis:** Utilizes an LLM to generate descriptive text for edges based on in-text citations
- **Output:** Renders a temporary graph visualization in the web UI
- **Persistence:** Basic SQLite storage with TypeORM integration

## Development Roadmap

### Phase 1: Foundational Enhancements

> Objective: Transition from prototype to robust, scalable application

- [ ] **1.1. Implement Asynchronous Task Processing**
  - **Problem:** Synchronous processing leads to long request times and potential timeouts
  - **Solution:** Implement task queue with real-time progress updates
  - **Outcome:** Improved responsiveness and support for complex analyses

- [ ] **1.2. Integrate Persistent Graph Database**
  - **Problem:** Analysis results are ephemeral and lost after sessions
  - **Solution:** Integrate Neo4j for persistent knowledge graph storage
  - **Outcome:** Cumulative knowledge graph that grows with each analysis

- [ ] **1.3. Upgrade UI/UX and Input Capabilities**
  - **Problem:** Basic UI with limited single URL input
  - **Solution:** Modern dashboard with multiple URL support and PDF uploads
  - **Outcome:** Professional, user-friendly interface

### Phase 2: Core Feature Enhancement & Interactivity

> Objective: Transform into interactive knowledge management tool

- [ ] **2.1. Implement "Second Brain" Integration**
  - **Target:** Obsidian integration with Juggl and Dataview plugins
  - **Method:** Sync module generating Markdown files from Neo4j database
  - **Outcome:** Seamless integration with personal knowledge management

- [ ] **2.2. Develop Interactive Graph Curation**
  - **Features:** Delete, edit, and create nodes and relationships
  - **Goal:** User-curated knowledge graph with improved accuracy
  - **Outcome:** Personalized and refined relationship mapping

- [ ] **2.3. Enrich Node Information**
  - **Data:** Extract abstracts, authors, publication dates via GROBID
  - **UI:** Detail panels with comprehensive metadata display
  - **Outcome:** Rich, content-addressable knowledge database

### Phase 3: Advanced Features & Platformization

> Objective: Multi-user intelligent research platform

- [ ] **3.1. User Accounts & Multi-Tenancy**
  - User authentication and isolated graph storage
  - Personal research spaces within shared infrastructure

- [ ] **3.2. Advanced Graph Analytics**
  - **Key Paper Identification:** PageRank and Centrality algorithms
  - **Research Path Discovery:** Shortest path algorithms between papers
  - **Topic Clustering:** Community detection for research area identification

- [ ] **3.3. Intelligent Recommendation System**
  - AI-powered paper recommendations based on existing knowledge graph
  - Personalized research direction suggestions

## Technical Architecture Analysis

This section provides an analysis of the current codebase, identifying the main application files for both the frontend and backend, along with their respective dependencies.

## Frontend

The frontend of the Paper Master application is a React-based project.

-   **Main Application Files:**
    -   `frontend/src/main.tsx`: The entry point of the React application.
    -   `frontend/src/App.tsx`: The main application component that defines the structure and routing of the frontend.
    -   `frontend/src/pages/`: This directory likely contains the different pages of the application.
    -   `frontend/src/components/`: This directory likely contains reusable UI components.

-   **Dependencies:**
    The frontend dependencies are listed in the `frontend/package.json` file. Key libraries include:
    -   **Framework:** `react`, `react-dom`
    -   **Build Tool:** `vite`
    -   **Styling:** `tailwindcss`, `@mui/material`, `@emotion/react`, `@emotion/styled`
    -   **Graph Visualization:** `vis-network`, `d3`
    -   **HTTP Client:** `axios`
    -   **Routing:** `react-router-dom`
    -   **State Management:** `zustand`
    -   **Linting and Formatting:** `eslint`, `typescript`

-   **Installation:**
    To install the frontend dependencies, run the following command in the `frontend` directory:
    ```bash
    npm install
    ```

-   **Running the Frontend:**
    To start the development server for the frontend, run the following command in the `frontend` directory:
    ```bash
    npm run dev
    ```

## Backend

The backend of the Paper Master application is a Node.js project using Express.js.

-   **Main Application File:**
    -   `backend/src/index.ts`: The entry point of the backend server. This file sets up the Express server, middleware, and routes.
    -   `backend/src/routes/`: This directory likely defines the API endpoints.
    -   `backend/src/controllers/`: This directory likely contains the logic for handling requests to the API endpoints.
    -   `backend/src/services/`: This directory likely contains the business logic of the application.
    -   `backend/src/entities/`: This directory likely defines the database schema using TypeORM.

-   **Dependencies:**
    The backend dependencies are listed in the `backend/package.json` file. Key libraries include:
    -   **Framework:** `express`
    -   **Database:** `sqlite3`, `typeorm`
    -   **API Interaction:** `axios`, `openai`
    -   **Middleware:** `cors`
    -   **Environment Variables:** `dotenv`
    -   **Scheduled Tasks:** `node-cron`
    -   **Development:** `nodemon`, `ts-node`, `typescript`, `eslint`

-   **Installation:**
    To install the backend dependencies, run the following command in the `backend` directory:
    ```bash
    npm install
    ```

-   **Running the Backend:**
    To start the development server for the backend, run the following command in the `backend` directory:
    ```bash
    npm run dev
    ```

## Full Project Setup

To install all dependencies for both the frontend and backend, you can use the `install:all` script from the root `package.json` (if it exists) or run `npm install` in both the `frontend` and `backend` directories.

To run the entire project in development mode, you can use the `dev` script from the root `package.json` which should concurrently start both frontend and backend servers.

