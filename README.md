# API Pulse

A dashboard for testing HTTP endpoints and watching how they perform. Send a request, see the status and response time, and get flagged when an endpoint is slower than you allow.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![Flask](https://img.shields.io/badge/Flask-3.1-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
[![tests](https://github.com/Jitheswar/API-Pulse/actions/workflows/tests.yml/badge.svg)](https://github.com/Jitheswar/API-Pulse/actions/workflows/tests.yml)

## What you can do

- Send GET, POST, PUT, PATCH and DELETE requests with your own headers, body and query params
- See status code, response time, size and body for every run
- Set a response-time limit per URL and get flagged when it's exceeded
- Compare runs over time and find slow endpoints
- Group tests into collections
- Keep variable sets (dev, staging, prod) and use `{{variable}}` in URLs, headers and bodies
- Search and filter your full run history
- Register and log in with JWT. The first user to register becomes admin.
- Rate limiting, plus blocking of requests to private IP ranges (SSRF protection)

## Run it

You need Python 3.10 or newer (3.12 recommended).

```bash
chmod +x start.sh
./start.sh
```

That creates a virtual environment, installs the dependencies and starts the app at http://localhost:5000.

Or do it by hand:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # optional
python run.py
```

Open the app, register an account, paste a URL (for example `https://jsonplaceholder.typicode.com/posts`) and hit **Send**. Results show up in the History and Analytics tabs.

## Docker

```bash
docker-compose up --build
```

This starts the app on port 5000, PostgreSQL on 5432 and Redis on 6379.

## Settings

Set these as environment variables. `.env.example` has the full list.

| Variable | Default | What it does |
|---|---|---|
| `FLASK_ENV` | `development` | `development` or `production` |
| `SECRET_KEY` | dev fallback | Flask secret key |
| `JWT_SECRET_KEY` | dev fallback | JWT signing key |
| `DATABASE_URL` | `sqlite:///api_monitor.db` | Database connection string |
| `RATELIMIT_STORAGE_URI` | `memory://` | Use `redis://` in production |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `PORT` | `5000` | Server port |

## API

Every route needs a JWT except register, login and `/health`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `GET /api/auth/me` |
| Run a test | `POST /api/test` |
| History | `GET /api/history`, `GET` or `DELETE /api/history/:id`, `DELETE /api/history` |
| Analytics | `GET /api/analytics/performance`, `/summary`, `/slow`, `/compare` |
| Thresholds | `GET` or `POST /api/thresholds`, `DELETE /api/thresholds/:id` |
| Collections | `GET /api/collections` |
| Environments | `GET` or `POST /api/environments`, `PUT` or `DELETE /api/environments/:id`, `POST /api/environments/resolve` |
| Health | `GET /health` |

Example body for `POST /api/test`:

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

## Tests

```bash
source venv/bin/activate
pip install pytest
pytest tests/ -v
```

Tests use an in-memory SQLite database and need no other services.

## Deploying

Render: connect the repo and it picks up `render.yaml`. Set `DATABASE_URL` to a managed PostgreSQL instance.

Heroku:

```bash
heroku create api-pulse
heroku addons:create heroku-postgresql:mini
heroku config:set SECRET_KEY=$(openssl rand -hex 32)
heroku config:set JWT_SECRET_KEY=$(openssl rand -hex 32)
git push heroku main
```

Any VPS: `docker-compose up -d --build`.

## License

MIT
MIT
