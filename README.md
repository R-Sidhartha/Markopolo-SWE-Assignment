# Ticket Service – Concurrency Fix Assignment

This repository contains three stages of the service:

- Original buggy implementation (race condition exists)
- Buggy version + reproduction script
- Final fixed implementation

Each stage is tagged so it’s easy to test everything step by step.

---

# 🏷 Git Tags

The repo includes the following tags:

- `original-buggy-version` → Original implementation (contains race condition)
- `reproduction-added` → Buggy version + repro script added
- `fixed-version` → Final corrected implementation

You can switch between versions using:

```bash
git checkout <tag-name>
```
# ✅ Testing the buggy Version

How to Reproduce the Bug
Step 1 – Checkout buggy version with repro script
```bash
git checkout reproduction-added
```

Step 2 – Start the server again
```bash
npm run dev
```

Step 3 – Run the same repro script
```bash
npm run repro
```
Expected Result (buggy Version)
You should now see:
- BUG REPRODUCED: duplicates and/or overselling detected.
- A Table showing duplicate tickets 

# ✅ Testing the Fixed Version

Step 1 – Checkout the fixed version
```bash
git checkout fixed-version
```

Step 2 – Start the server again
```bash
npm run dev
```

Step 3 – Run the same repro script
```bash
npm run repro
```
Expected Result (fixed Version)
You should now see:
- \nNo duplicates / oversell observed. This likely means the service has already been fixed.
- An empty Table, indicating no duplicates


# Ticket Service - Environment Setup

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose

## Setup Instructions

### 1. Start PostgreSQL Database

```bash
docker-compose up -d
```

This starts PostgreSQL on port 5433 with:
- Database: `tickets`
- Username: `postgres`
- Password: `postgres`

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Database

```bash
npm run seed
```

### 4. Start Application

```bash
npm run dev
```

Server runs on http://localhost:3000

## Environment Variables

No additional configuration needed - uses default values:
- Database: `localhost:5433/tickets`
- API Server: `http://localhost:3000`

## Verify Setup

Test the API:
```bash
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","eventId":"EVENT001","quantity":8}'
```

## Troubleshooting

### Database not connecting
```bash
docker-compose down -v
docker-compose up -d
```

### Port conflicts
Check ports 3000 and 5433 are available or modify in `docker-compose.yml`
