# Railway Deployment

Quick reference for deploying market-maker services to Railway.

## Services

| Service | Command | Port | Description |
|---------|---------|------|-------------|
| **bebop** | `yarn bebop` | - | Bebop RFQ client (WebSocket) |
| **relay** | `yarn relay` | 3004 | Bebop price relay (WebSocket server) |

## Deploy to Railway

### One-Time Setup

1. **Create Railway project**: [railway.app/new](https://railway.app/new)
2. **Connect GitHub repo**: Select `greek-web`
3. **Create Bebop service**:
   - Root Directory: `market-maker`
   - Start Command: `yarn bebop`
   - Add environment variables
4. **Create Relay service** (same project):
   - Click "+ New" → GitHub Repo → Same repo
   - Root Directory: `market-maker`
   - Start Command: `yarn relay`
   - Add environment variables

### Environment Variables

**Bebop Service**:
```bash
CHAIN_ID=8453
MAKER_ADDRESS=0x...
PRIVATE_KEY=0x...
BEBOP_MARKETMAKER=xxx
BEBOP_AUTHORIZATION=xxx
BEBOP_API_URL=https://api.bebop.xyz
DEFAULT_IV=0.8
RISK_FREE_RATE=0.05
BID_SPREAD=0.02
ASK_SPREAD=0.02
```

**Relay Service**:
```bash
CHAIN_ID=8453
MAKER_ADDRESS=0x...
PRIVATE_KEY=0x...
RELAY_WS_PORT=3004
BEBOP_CHAINS=ethereum,base,arbitrum
DEFAULT_IV=0.8
RISK_FREE_RATE=0.05
```

### Railway CLI

```bash
# Install
npm i -g @railway/cli

# Login and link
railway login
railway link

# View logs
railway logs --service market-maker-bebop
railway logs --service market-maker-relay

# Set variables
railway variables set CHAIN_ID=8453 --service market-maker-bebop
```

## Architecture

```
GitHub Repo (greek-web)
  └── market-maker/
      ├── src/
      │   ├── bebop.ts  ──→ Railway Service 1 (bebop)
      │   └── relay.ts  ──→ Railway Service 2 (relay)
      └── package.json

Railway auto-deploys on push to main
```

## URLs

After deployment, Railway assigns:
- **Bebop**: `market-maker-bebop-production.up.railway.app` (internal only)
- **Relay**: `market-maker-relay-production.up.railway.app` (WebSocket endpoint)

## Details

See [market-maker/DEPLOY.md](market-maker/DEPLOY.md) for full deployment guide.
