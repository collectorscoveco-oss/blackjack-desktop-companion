# Mission Control Dashboard

A fast, lightweight local web app for monitoring an OpenClaw host.

## Features

- System online/offline indicator
- Host health metrics (CPU load, memory, uptime, disk)
- Security score based on `openclaw security audit`
- Security issue list with severity + remediation text
- Kanban board with persistent JSON storage
- Dark, modern dashboard UI

## Run

```bash
npm start
```

Then open <http://localhost:3000>.

## API

- `GET /api/status` - live mission control data
- `GET /api/kanban` - current Kanban board
- `POST /api/kanban` - replace Kanban board JSON

## Notes

- The app shells out to `openclaw status` and `openclaw security audit` for live OpenClaw status and security findings.
- Designed to run locally on a server today, while keeping the structure simple enough to evolve into a future SaaS control plane.
