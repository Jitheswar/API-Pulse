# API Pulse

A full-stack API testing and monitoring tool built with Flask. Test any HTTP endpoint, track response times, set performance thresholds, and visualize analytics — all from a futuristic neon-themed dashboard.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![Flask](https://img.shields.io/badge/Flask-3.1-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
[![tests](https://github.com/Jitheswar/API-Pulse/actions/workflows/tests.yml/badge.svg)](https://github.com/Jitheswar/API-Pulse/actions/workflows/tests.yml)

---

## Features

- **API Testing** — Send GET, POST, PUT, PATCH, DELETE requests with custom headers, body, and query params
- **Response Monitoring** — Track status codes, response times, content length, and response bodies
- **Performance Analytics** — Aggregated stats, slow endpoint detection, and run-over-run comparison
- **Threshold Alerts** — Set per-URL response time thresholds and get flagged when they're breached
- **Collections** — Group related API tests for organized workflows
- **Environments** — Define variable sets (dev, staging, prod) with `{{variable}}` interpolation in URLs, headers, and bodies
- **History** — Full searchable log of every test run with filtering and bulk delete
- **JWT Authentication** — Register/login flow with access + refresh tokens and role-based admin controls
- **Rate Limiting** — Configurable per-endpoint rate limits (memory or Redis-backed)
- **SSRF Protection** — Blocks requests to private/internal IP ranges
- **CORS Support** — Configurable allowed origins
- **Docker Ready** — Multi-stage Dockerfile + docker-compose with PostgreSQL and Redis
- **One-Click Deploy** — Render.com and Heroku configs included

---

## Tech Stack

| Layer       | Technology                                              |
|-------------|---------------------------------------------------------|
| Backend     | Flask, SQLAlchemy, Flask-Migrate, Flask-JWT-Extended     |
| Database    | SQLite (dev) / PostgreSQL (prod)                        |
| Caching     | Redis (prod rate limiting)                              |
| Frontend    | Vanilla JS, CSS3 with glassmorphism + particle effects  |
| Serialization | Marshmallow                                           |
| Server      | Gunicorn (prod), Flask dev server (dev)                 |
| Containerization | Docker, docker-compose                             |

---

## Quick Start

### Prerequisites

- Python 3.10+ (3.12 recommended)
- pip

### Run with one command

```bash
chmod +x start.sh
./start.sh
```

This will:
1. Create a Python virtual environment
2. Install all dependencies
3. Start the Flask development server on `http://localhost:5000`

### Manual Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Copy and edit environment variables
cp .env.example .env

# Run the development server
python run.py
```

The app runs at **http://localhost:5000** by default.

---

## Docker Setup

### Using docker-compose (recommended for production-like setup)

```bash
docker-compose up --build
```

This starts three services:
- **app** — Flask application on port 5000
- **db** — PostgreSQL 16 on port 5432
- **redis** — Redis 7 on port 6379

### Standalone Docker

```bash
docker build -t api-pulse .
docker run -p 5000:5000 \
  -e SECRET_KEY=your-secret \
  -e JWT_SECRET_KEY=your-jwt-secret \
  -e DATABASE_URL=sqlite:///api_monitor.db \
  api-pulse
```

---

## Configuration

All configuration is via environment variables. See `.env.example` for the full list:

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | `development` or `production` |
| `SECRET_KEY` | dev fallback | Flask secret key |
| `JWT_SECRET_KEY` | dev fallback | JWT signing key |
| `DATABASE_URL` | `sqlite:///api_monitor.db` | Database connection string |
| `RATELIMIT_STORAGE_URI` | `memory://` | Rate limiter backend (`redis://` for prod) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `PORT` | `5000` | Server port |

---

## API Endpoints

All API routes require JWT authentication unless noted.

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create a new account | No |
| POST | `/api/auth/login` | Get access + refresh tokens | No |
| POST | `/api/auth/refresh` | Refresh access token | Refresh token |
| GET | `/api/auth/me` | Get current user profile | Yes |

> The first registered user automatically receives the `admin` role.

### API Testing (`/api`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/test` | Execute an API test |

**Request body:**
```json
{
  "url": "https://api.example.com/users",
  "method": "GET",
  "headers": { "Authorization": "Bearer ..." },
  "body": {},
  "params": { "page": "1" },
  "environment_id": 1
}
```

### History (`/api/history`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | List test history (paginated, filterable) |
| GET | `/api/history/:id` | Get single test result |
| DELETE | `/api/history/:id` | Delete a test result |
| DELETE | `/api/history` | Bulk delete test results |

### Analytics (`/api/analytics`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/performance` | Aggregated performance metrics |
| GET | `/api/analytics/summary` | Dashboard summary stats |
| GET | `/api/analytics/slow` | Slow endpoints report |
| GET | `/api/analytics/compare` | Compare runs over time |

### Thresholds (`/api/thresholds`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/thresholds` | List all thresholds |
| POST | `/api/thresholds` | Create a response time threshold |
| DELETE | `/api/thresholds/:id` | Delete a threshold |

### Collections (`/api/collections`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collections` | List grouped test collections |

### Environments (`/api/environments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/environments` | List environments |
| POST | `/api/environments` | Create environment |
| PUT | `/api/environments/:id` | Update environment |
| DELETE | `/api/environments/:id` | Delete environment |
| POST | `/api/environments/resolve` | Resolve `{{variables}}` in a string |

### Health (`/health`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check (app + database) | No |

---

## Project Structure

```
CisHackathon/
├── app/
│   ├── __init__.py           # Flask app factory (create_app)
│   ├── config.py             # Dev / Prod / Test configurations
│   ├── extensions.py         # SQLAlchemy, JWT, CORS, Limiter instances
│   ├── models/
│   │   ├── user.py           # User model (auth, roles)
│   │   ├── api_test.py       # ApiTest model (test results)
│   │   ├── threshold.py      # Threshold model (perf limits)
│   │   └── environment.py    # Environment model (variable sets)
│   ├── routes/
│   │   ├── auth.py           # Register, login, refresh, profile
│   │   ├── testing.py        # Execute API tests
│   │   ├── history.py        # Test history CRUD
│   │   ├── analytics.py      # Performance analytics
│   │   ├── thresholds.py     # Threshold management
│   │   ├── collections.py    # Test collections
│   │   ├── environments.py   # Environment variables
│   │   └── health.py         # Health check endpoint
│   ├── services/
│   │   └── api_tester.py     # HTTP request execution + SSRF protection
│   ├── middleware/
│   │   └── error_handlers.py # Global error handlers
│   └── utils/
│       └── validation.py     # Marshmallow request schemas
├── templates/
│   └── index.html            # Dashboard SPA template
├── static/
│   ├── css/style.css         # Glassmorphism + neon theme
│   └── js/app.js             # Dashboard logic + particle effects
├── tests/                    # Pytest test suite
│   ├── conftest.py           # Test fixtures (app, client, auth headers)
│   ├── test_auth.py
│   ├── test_testing.py
│   ├── test_history.py
│   ├── test_analytics.py
│   ├── test_thresholds.py
│   ├── test_environments.py
│   └── test_health.py
├── run.py                    # Entry point
├── start.sh                  # One-command dev setup + run
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
├── Dockerfile                # Multi-stage production build
├── docker-compose.yml        # Full stack (app + PostgreSQL + Redis)
├── Procfile                  # Heroku deployment
└── render.yaml               # Render.com deployment
```

---

## Running Tests

```bash
source venv/bin/activate
pip install pytest
pytest tests/ -v
```

Tests use an in-memory SQLite database and require no external services.

---

## Deployment

### Render.com

1. Push to a GitHub repository
2. Connect the repo on [render.com](https://render.com)
3. Render will auto-detect `render.yaml` and configure the service
4. Set `DATABASE_URL` to a managed PostgreSQL instance

### Heroku

```bash
heroku create api-pulse
heroku addons:create heroku-postgresql:mini
heroku config:set SECRET_KEY=$(openssl rand -hex 32)
heroku config:set JWT_SECRET_KEY=$(openssl rand -hex 32)
git push heroku main
```

### Docker (any VPS)

```bash
docker-compose up -d --build
```

---

## Getting Started (First Use)

1. Open `http://localhost:5000` in your browser
2. Click **Register** and create an account (first user gets admin role)
3. Log in with your credentials
4. Enter a URL (e.g., `https://jsonplaceholder.typicode.com/posts`) and click **Send**
5. View results in the History and Analytics tabs

---

## License

MIT
