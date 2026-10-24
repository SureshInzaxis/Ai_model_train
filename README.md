# AI-Powered Exam Question Analyzer

A complete application to upload PDF question papers, extract questions, organize by subject/chapter/year, verify answers with local AI (Ollama/DeepSeek), and manage corrections through human approval workflows.

Uses **PostgreSQL** (not MongoDB), **React + Vite** frontend, **Express + Sequelize** backend, and **BullMQ + Redis** for job queues.

## Quick Start

```bash
# 1. Start Redis (for job queues)
redis-server

# 2. Start PostgreSQL and create database
createdb question_analyzer 2>/dev/null || psql -U postgres -c "CREATE DATABASE question_analyzer;"

# 3. Install and start Ollama, then pull model
ollama serve
ollama pull qwen3.8:27b

# 4. Install server dependencies
cd server && npm install && cd ..

# 5. Install client dependencies
cd client && npm install && cd ..

# 6. Configure environment
copy server\.env.example server\.env

# 7. Start server (handles PostgreSQL/Redis/Ollama gracefully if some are offline)
cd server && node index.js

# 8. Start client (separate terminal)
cd client && npm run dev
```

Open http://localhost:5173 — the dashboard auto-detects the backend at http://localhost:5000.

## Required Software (Windows 10)

| Software | How to Install | Why Needed |
|----------|---------------|------------|
| **Node.js 18+** | https://nodejs.org (LTS) | Runtime for both frontend and backend |
| **PostgreSQL 14+** | https://www.postgresql.org/download/ | Database for all questions, PDFs, jobs, reviews |
| **Redis 7+** | `winget install Redis` or https://redis.io | Job queue for BullMQ (background PDF processing) |
| **Ollama** | https://ollama.com/download | Local AI for answer verification |
| **Poppler** | `choco install poppler` or https://github.com/oschwartz10613/poppler-windows | PDF-to-image conversion for OCR of scanned PDFs |
| **Git** | https://git-scm.com | Version control (optional but recommended) |

### Windows-specific notes

- **Poppler**: Required by `pdf2pic` for converting scanned PDF pages to images before OCR. Without it, text-based PDFs still work fully; only OCR on scanned PDFs will be unavailable (those PDFs are marked for manual review instead).
- **Redis**: On Windows 10, install via `winget install Redis` or use WSL2: `sudo apt install redis-server`.
- **PostgreSQL**: During installation, set the `postgres` user password. Update `DB_PASSWORD` in `server/.env` accordingly.
- **File paths**: The server uses `path.resolve()` which handles Windows path separators automatically.
- **Case sensitivity**: MySQL table names are case-insensitive on Windows by default.

## Testing Ollama Connectivity

```bash
# Check if Ollama is running:
curl http://localhost:11434/api/tags

# Expected output (shows available models):
# {"models":[{"name":"qwen3.8:27b",...}]}

# Pull the model if not present:
ollama pull qwen3.8:27b

# Test the API directly:
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3.8:27b","prompt":"What is 2+2?","stream":false}'
```

The server health endpoint at `http://localhost:5000/api/health` reports Ollama's status.

## Hardware Considerations

Designed for your Intel i7-3770 (16GB RAM, NVIDIA Quadro 600 1GB):

- **Local AI**: Uses Ollama model `qwen3.8:27b` for answer/explanation checks. 27B is heavy; keep verification concurrency low.
- **Concurrency limits**: OCR uses 1 concurrent worker, AI verification uses 2. Configured via `.env`.
- **Batch processing**: Questions are verified in batches of 10 (configurable).
- **No GPU required**: Ollama CPU-only mode. No CUDA dependencies.
- **Memory management**: Each AI request sends one question at a time (~200-500 tokens).

## Project Structure

```
question-analyzer/
  client/                    React + Vite frontend
    src/
      components/           Layout, StatsGrid, PdfUploadForm, QuestionCard,
                              ReviewPanel, FilterBar, DataTable, JobStatus
      pages/                Dashboard, PdfUpload, PdfList, QuestionList,
                              QuestionView, ReviewQueue, ImportForm, ExportForm
      services/api.js       Axios API client
  server/                    Express + Sequelize backend
    src/
      config/               database.js, redis.js, ollama.js, logger.js, upload.js
      models/               Subject, Chapter, PDFDocument, Question,
                              ProcessingJob, VerificationResult, ReviewHistory,
                              ImportJob, User
      middleware/           asyncHandler, validateRequest, errorHandler
      utils/                fileHash.js, helpers.js
      services/             pdfService.js, ocrService.js, questionParser.js,
                              ollamaService.js, seedService.js
      jobs/                 queueManager.js, extractionWorker.js, verificationWorker.js
      controllers/          health, pdf, questions, jobs, reviews, import, export
      routes/               health, pdf, questions, jobs, reviews, import, export
      tests/                health, pdf, question tests
    database/init.sql       Database + user setup
    uploads/                Stored PDFs (gitignored, not public)
    .env.example
    index.js                Entry point
  .gitignore
  README.md
```

## Database Setup

### PostgreSQL (recommended)

```bash
# Via pgAdmin: Right-click "Databases" → Create → Database → Name: question_analyzer
# Or via command line:
createdb -U postgres question_analyzer
```

### Database Schema

All data stored in PostgreSQL. Key tables:

| Table | Description |
|-------|-------------|
| `subjects` | Physics, Chemistry, Mathematics, Biology |
| `chapters` | Chapters per subject |
| `pdf_documents` | Uploaded PDFs with metadata, SHA-256 hash (dedup), status |
| `questions` | Extracted questions with original/verified/approved answers |
| `processing_jobs` | Extraction and verification job tracking |
| `verification_results` | AI verification results per question |
| `review_history` | Audit trail of all review actions |
| `import_jobs` | Import job tracking |
| `users` | Reviewer accounts |

## API Endpoints

### Health
```
GET /api/health          — Full health check (PostgreSQL, Redis, Ollama)
GET /api/health/stats    — Database statistics
GET /                        — Server info
```

### PDF Management
```
POST   /api/pdfs/upload          — Upload PDF(s) with metadata
GET    /api/pdfs                 — List PDFs (with filters)
GET    /api/pdfs/:id             — Get PDF details
GET    /api/pdfs/:id/page/:page  — Render PDF page as PNG
```

### Questions
```
GET    /api/questions              — Search/filter (paginated)
GET    /api/questions/options      — Filter options
GET    /api/questions/stable/:id   — Get by stable ID
GET    /api/questions/:id          — Get question with history
```

### Jobs
```
GET    /api/jobs                   — List jobs
GET    /api/jobs/stats             — Queue statistics
GET    /api/jobs/:id               — Job status
POST   /api/jobs/:id/retry         — Retry failed job
POST   /api/jobs/verify            — Queue AI verification
```

### Reviews
```
GET    /api/reviews/queue          — Questions pending review
GET    /api/reviews/:id/history    — Review history
POST   /api/reviews/:id/approve    — Approve AI suggestion
POST   /api/reviews/:id/reject     — Reject, keep original
POST   /api/reviews/:id/edit       — Edit with custom answer
POST   /api/reviews/:id/comment    — Add comment
```

### Import/Export
```
POST   /api/import                 — Import (CSV/Excel/JSON)
GET    /api/export/questions       — Export to CSV/Excel
GET    /api/export/review-queue    — Export review queue
```

### Example: Upload a PDF
```bash
curl -X POST http://localhost:5000/api/pdfs/upload \
  -F "pdfs=@question_paper.pdf" \
  -F "subject=PHY" \
  -F "chapter=Mechanics" \
  -F "examYear=2024" \
  -F "examType=JEE"
```

### Example: Search questions
```bash
curl "http://localhost:5000/api/questions?subject=PHY&chapter=Mechanics&year=2024"
```

## Environment Configuration

Copy `server/.env.example` to `server/.env`:

```
DB_PASSWORD=your_postgres_password_here     # Your PostgreSQL postgres user password
OLLAMA_MODEL=qwen3.8:27b                  # Run `ollama list` to verify
OCR_CONCURRENCY=1                         # Keep low on 16GB RAM
VERIFICATION_CONCURRENCY=2                # Questions verified in parallel
JOB_BATCH_SIZE=10                         # Questions per AI batch
```

## Testing

```bash
cd server && npm test
```

Tests cover health check, question listing, and PDF upload validation.

## Architecture Notes

- **Graceful degradation**: Server starts even if MySQL, Redis, or Ollama is offline.
- **Background jobs**: PDF extraction and AI verification run via BullMQ workers.
- **Secure file handling**: PDFs stored with SHA-256 hash filenames, never publicly served.
- **Idempotent operations**: Retries check for existing records to prevent duplicates.
- **No paid APIs**: Everything runs locally (Ollama, MySQL, Redis).

## Scripts

### Backend
```bash
npm run dev                 # Start server + workers with nodemon
npm run dev:server          # Server only
npm run test                # Run Jest tests
npm run db:init             # Initialize PostgreSQL database
```

### Frontend
```bash
npm run dev                 # Start Vite dev server
npm run build               # Production build
npm run lint                # Lint with oxlint
```
