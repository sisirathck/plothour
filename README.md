# StudyDuel ⏱️⚔️

<p align="center">
  <img src="public/studyduel_logo.png" alt="StudyDuel Logo" width="180" />
</p>

<p align="center">
  <strong>An open-source, Apple-grade time-tracking & friendly accountability platform for students and focused builders.</strong>
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#database--docker">Database</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js & Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

## Overview

**StudyDuel** blends precision time-tracking, deep personal cognitive insights, and friendly social accountability into a cohesive, distraction-free productivity app. 

Whether you're studying for competitive exams, learning a new engineering stack, or working toward ambitious personal milestones, StudyDuel gives you the clarity of quantified self-analytics paired with the motivational boost of study duels with peers.

---

## ✨ Key Features

### ⏱️ Reliable Smart Time Tracker
- **Atomic Session Tracking:** Accurate timestamps with zero browser-interval drift.
- **Floating Mini-Dock:** Keep an eye on your active session without breaking your workflow.
- **Project & Task Tagging:** Group study bouts by project, subproject, and customizable color tags.
- **Manual History & Quick Edits:** Fix accidental timer overruns or log offline study sessions with retroactive date and duration validation.

### 📊 Apple-Grade Bento Analytics Dashboard
- **Focus Depth & Flow State:** Cognitive session distribution categorized into *Sprint (<20m)*, *Pomodoro (20–45m)*, *Deep Flow (45–90m)*, and *Marathon (>90m)* tiers.
- **Circadian Focus Window:** Discover your peak cognitive hours (*Morning*, *Afternoon*, *Evening*, or *Night*) based on historical volume.
- **Day-of-Week Power Rhythm:** Identify your personal peak productivity day and weekday study patterns.
- **Daily Hours & Study Velocity:** High-density daily output bar charts paired with active day pace, daily target hit rates, and personal record days.
- **Weekly Trend & 4-Week Moving Average:** Track weekly momentum with moving averages to spot burnout or building consistency.
- **Session Length Distribution:** Bucket histogram analyzing session durations.
- **24-Hour Heatmap & Year Activity Calendar:** GitHub-style chronological activity calendar and 24h × 7-day time-of-day matrix.
- **Personalized Bento Customization:** Pin, collapse, or reorder any dashboard section to suit your personal workflow.

### ⚔️ Social Study Duels & Compare
- **Friendly Accountability:** Connect with classmates or study partners for opt-in progress comparisons.
- **Head-to-Head Stats:** Compare study volume, pace, and consistency across days, weeks, or custom time periods.
- **Privacy-First Data Model:** Session notes and task details remain private by default; share only aggregate progress and verified study hours.

### 🎯 Project Portfolio & Pace-Based Forecasting
- **Time Estimates & Deadlines:** Assign target hours and target completion dates to projects.
- **Pace-Based Finish Date:** Intelligent forecasting estimates when you will complete a project milestone based on your recent velocity.
- **Visual Progress Rings:** Real-time completion bars and milestone checklists.

### 🌓 Curated Light & Dark Themes
- **Dynamic Aesthetic Rotation:** Seamlessly switches between curated ambient artwork collections on light and dark modes.
- **Refined Typography & Glassmorphism:** Crafted with tailored HSL tokens, smooth transitions, and high-contrast accessibility.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Lucide Icons, Pure Vanilla CSS (CSS Variables, Bento Glassmorphism) |
| **Backend** | Node.js, Express 5, Cookie Parser, CORS, Dotenv |
| **Authentication** | Argon2 password hashing, JWT (HTTP-only cookies), Google OAuth (optional) |
| **Database** | PostgreSQL 16 (UUID primary keys, indexed timestamps, constraints) |
| **Infrastructure** | Docker, Docker Compose |
| **Tooling** | Oxlint, ES Modules |

---

## 🚀 Getting Started

Follow these steps to run StudyDuel locally on your machine.

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- [Docker & Docker Compose](https://www.docker.com/) (for running local PostgreSQL)

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/StudyDuel.git
cd StudyDuel
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local `.env` file by copying the example template:

```bash
cp .env.example .env
```

Update your local database credentials or secret keys if desired:

```env
POSTGRES_USER=studyduel
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=studyduel
DATABASE_URL=postgresql://studyduel:your_secure_password@localhost:5432/studyduel
AUTH_SECRET=your_random_jwt_secret_key_here
```

### 4. Start the PostgreSQL Database

Start the PostgreSQL container with Docker Compose:

```bash
docker compose up -d db
```

> **Note:** On first startup, Docker automatically executes [`database/001_initial_schema.sql`](database/001_initial_schema.sql) to create all tables and indexes.

Verify the container is healthy:

```bash
docker compose ps
```

### 5. Start the Development Server

Run both the Vite frontend and the Express backend concurrently with one command:

```bash
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3001](http://localhost:3001)

You can explore the app immediately via **"Try demo"** on the login screen or register an account.

---

## 📁 Project Structure

```text
StudyDuel/
├── database/               # PostgreSQL schema definitions & migrations
│   └── 001_initial_schema.sql
├── docker-compose.yml      # Local PostgreSQL container specification
├── public/                 # Static assets, themes, and curated hero artwork
├── scripts/                # Development startup runner
│   └── dev.js
├── server/                 # Express backend API
│   ├── routes/             # Authentication & API endpoints
│   ├── db.js               # PostgreSQL connection pool
│   └── index.js            # Server entrypoint
├── src/                    # Frontend React application
│   ├── assets/             # Brand logos & icons
│   ├── components/         # Shared UI (Navigation, AppShell, ThemeToggle, Auth)
│   ├── context/            # Global context (Theme, Auth)
│   ├── modules/
│   │   ├── dashboard/      # Bento analytics, charts, velocity & habit tracking
│   │   ├── timer/          # Live stopwatch, mini-timer, session history
│   │   ├── compare/        # Social study duels & friend comparisons
│   │   ├── manage/         # Project management, milestones & forecasts
│   │   └── settings/       # User profile, goals, audio reminders, preferences
│   ├── App.jsx             # Root routing and application layout
│   └── index.css           # Global design system & theme tokens
├── package.json
└── vite.config.js
```

---

## 🗄 Database & Migrations

The database uses PostgreSQL with UTC timestamps, enforced foreign keys, and indexes on user activity.

- **Stop the database (preserves data):**
  ```bash
  docker compose down
  ```
- **Reset the database (destructive):**
  ```bash
  docker compose down -v
  ```
- **Apply a new migration:**
  ```bash
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/002_migration.sql
  ```

---

## 📜 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Launches frontend (`:5173`) and API server (`:3001`) simultaneously |
| `npm run build` | Compiles production bundle with Vite into `/dist` |
| `npm run server` | Starts only the Express API server |
| `npm run lint` | Runs ultra-fast code linting via Oxlint |
| `npm run preview` | Previews the compiled production build locally |

---

## 🤝 Contributing

Contributions are warmly welcome! Whether you are reporting a bug, improving documentation, or submitting a feature PR:

1. **Fork** the project repository.
2. **Create a branch** for your feature or fix (`git checkout -b feature/amazing-feature`).
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`).
4. **Push** to the branch (`git push origin feature/amazing-feature`).
5. Open a **Pull Request**.

Please ensure synthetic demo data is used for tests and never commit personal `.env` files or tracking data.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) (or chosen open-source license).
