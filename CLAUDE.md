# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **options protocol** built on Scaffold-ETH 2, implementing a dual-token options system where both long (Option) and short (Redemption) positions are fully transferable ERC20 tokens. The protocol supports any ERC20 tokens as collateral or consideration, enabling flexible options trading beyond traditional cash/asset distinctions.

### What Makes This Protocol Unique

- **Dual ERC20 Tokens**: Both option sides (long and short) are freely tradable ERC20 tokens
- **Any Token Pairs**: Create options between any ERC20 tokens (not limited to ETH/stablecoins)
- **Decimal Normalization**: Handles tokens with different decimals (e.g., USDC has 6, WETH has 18)
- **Gas-Efficient Deployment**: Uses EIP-1167 minimal proxy clones for ~95% gas savings
- **Auto-Settling Transfers**: Smart transfer logic that auto-redeems matched pairs
- **Collateral Backing**: Every option token is 1:1 backed by deposited collateral
- **Post-Expiration Flexibility**: Redemption tokens can be redeemed for collateral or equivalent consideration value

## Repository Structure

> **Note**: Smart contract source code (Solidity) lives in a separate repository. This repo contains the **frontend**, **market-maker**, and **ABI/deployment artifacts** only.

```
.
├── core/                  # Next.js frontend (Scaffold-ETH 2)
│   ├── app/
│   │   ├── trade/         # Trading page (options chain + order entry)
│   │   ├── options/       # Alternative trading interface
│   │   ├── mint/          # Option minting interface
│   │   ├── _opswap/       # Experimental page
│   │   ├── contexts/      # React contexts (PricingContext)
│   │   ├── lib/           # WebSocketManager, PricingStreamManager, RfqPricingStreamManager
│   │   └── hooks/         # usePricingStream
│   ├── hooks/scaffold-eth/  # Scaffold-ETH hooks
│   ├── components/scaffold-eth/  # Scaffold-ETH components
│   └── scaffold.config.ts
├── market-maker/          # Market maker service (bebop, relay, direct modes)
├── abi/                   # Deployed contract ABIs and addresses
│   ├── deployedContracts.ts
│   └── chains/            # Per-chain ABIs (mainnet.ts, base.ts, chain130.ts, foundry.ts)
├── out/                   # Compiled contract artifacts
└── docs/                  # Documentation
```

## Development Commands

### Frontend Development
```bash
yarn start                # Start Next.js frontend at http://localhost:3000
yarn next:build           # Build Next.js production bundle
yarn next:check-types     # TypeScript type checking
yarn next:lint            # Lint Next.js code
yarn vercel               # Deploy to Vercel
```

### Market Maker
```bash
cd market-maker
yarn direct               # Standalone quote server (HTTP + WebSocket)
yarn bebop                # Bebop RFQ client
yarn relay                # Bebop price relay
yarn dev:direct           # Dev mode with watch
yarn dev:bebop            # Dev mode with watch
yarn dev:relay            # Dev mode with watch
yarn build                # Build with tsup → dist/
yarn fetch-metadata       # Cache option metadata from chain
```

### Market Maker Deployment (DigitalOcean)
```bash
cd market-maker
docker compose up -d --build   # Build and start bebop + relay
docker compose logs -f         # View logs
docker compose restart bebop   # Restart a service
```

---

## Smart Contract API Reference

The contracts are deployed on-chain. ABIs are in `/abi/`. This section documents the contract interfaces for frontend/market-maker integration.

### Three Contracts

```
┌─────────────────┐
│ OptionFactory   │ ← Owned by: Deployer
│ Creates ↓       │
└─────────────────┘
┌─────────────────┐      ┌─────────────────────┐
│ Option          │◄─────┤ Redemption          │
│ (Long position) │ Owns │ (Short position)    │
│ Owner: User     │      │ Owner: Option       │
└─────────────────┘      └─────────────────────┘
```

### OptionFactory

Deploys new option pairs using EIP-1167 minimal proxy clones.

| Function | Description |
|----------|-------------|
| `createOption(collateral, consideration, expirationDate, strike, isPut)` | Deploy Option + Redemption pair |
| `createOptions(...)` | Batch deploy multiple option pairs |
| `transferFrom(from, to, amount, token)` | Centralized token transfer (only callable by Redemption contracts) |
| `blockToken(token)` / `unblockToken(token)` | Manage token blocklist |
| `fee` | Protocol fee (max 1%) |
| `blocklist(token)` | Check if token is blocked |

### Option (Long Position)

ERC20 token representing the right to exercise. Minted when user deposits collateral.

| Function | Description |
|----------|-------------|
| `mint(amount)` | Deposit collateral, receive Option + Redemption tokens |
| `exercise(amount)` | Burn Option tokens, pay consideration, receive collateral |
| `redeem(amount)` | Burn matched Option + Redemption pairs, receive collateral (pre-expiration) |
| `transfer(to, amount)` | ERC20 transfer with **auto-redeem** if recipient holds Redemptions |

**Auto-settling transfers**: When you transfer Option tokens to someone who holds Redemption tokens, it auto-redeems the minimum of both balances, returning collateral.

### Redemption (Short Position)

ERC20 token representing the obligation side. Holds all collateral and receives consideration.

| Function | Description |
|----------|-------------|
| `redeem(amount)` | Burn tokens, receive collateral (post-expiration only) |
| `redeemConsideration(amount)` | Burn tokens, receive equivalent consideration value |
| `sweep(holders[])` | Batch redemption for multiple holders (post-expiration) |
| `strike` | Strike price (18 decimal encoding) |
| `collateral` | Collateral token address |
| `consideration` | Consideration token address |
| `expirationDate` | Unix timestamp expiration |
| `isPut` | Put vs Call |
| `toConsideration(amount)` | Convert collateral amount to consideration |
| `toCollateral(amount)` | Convert consideration amount to collateral |

### Access Control

- **Factory**: Can call `transferFrom()` on behalf of Redemption contracts
- **Option**: Can call `mint()`, `exercise()`, `_redeemPair()`, `lock()`, `unlock()` on its Redemption
- **Anyone**: Can call `redeem()` on Redemption after expiration
- **Users**: Can call `mint()`, `exercise()`, `redeem()` on Option anytime

### Option Lifecycle

1. **Create**: `factory.createOption()` deploys a new Option + Redemption pair
2. **Mint**: User deposits collateral via `option.mint()`, receives both tokens (minus fee)
3. **Trade**: Both tokens are freely transferable ERC20s
4. **Exercise** (pre-expiration): Option holder calls `option.exercise()`, pays consideration, gets collateral
5. **Redeem pairs** (pre-expiration): Holder of both tokens calls `option.redeem()` to get collateral back
6. **Redeem** (post-expiration): Redemption holders call `redemption.redeem()` for collateral
7. **Sweep**: Anyone can batch-redeem for multiple holders after expiration

### Strike Price Encoding

Strikes are encoded with 18 decimals. Calls and puts store strikes differently:

| Type | Collateral | Consideration | Strike Encoding | Example |
|------|------------|---------------|-----------------|---------|
| Call | WETH | USDC | USDC per WETH | 2000 (pay 2000 USDC for 1 WETH) |
| Put | USDC | WETH | WETH per USDC | 0.0005 (pay 0.0005 WETH for 1 USDC) |

**For Black-Scholes, both need "USDC per WETH" format**, so puts are inverted: `1 / 0.0005 = 2000`

Conversion formula:
```
toConsideration(amount) = (amount * strike * 10^consDecimals) / (10^18 * 10^collDecimals)
```

### Option Token Units

- **Call tokens**: 1 token = right to buy 1 WETH at strike. BS price is correct as-is.
- **Put tokens**: 1 token = right to sell (1/strike) WETH, receiving 1 USDC. Price per token = BS price / strike.

Example with $2000 strike: standard put worth $400 → put token worth $400/2000 = $0.20

---

## Frontend (Scaffold-ETH 2)

Located in `core/`. Framework: Next.js 14+ (App Router), RainbowKit + Wagmi + Viem, Tailwind CSS.

### ABI & Deployed Contracts

Contract ABIs and addresses live in `/abi/deployedContracts.ts`, auto-generated per chain:

```typescript
import deployedContracts from "~~/abi/deployedContracts";
// Chains: 1 (mainnet), 130 (Unichain), 8453 (Base), 31337 (foundry)
```

### Scaffold-ETH Hooks

Always use these (never raw wagmi/viem) for automatic network switching and type safety:

```typescript
// Read contract state
const { data } = useScaffoldReadContract({
  contractName: "Option",
  functionName: "balanceOf",
  args: [address],
  watch: true,
});

// Write to contract
const { writeContractAsync } = useScaffoldWriteContract("Option");
await writeContractAsync({ functionName: "mint", args: [amount] });

// Watch events
useScaffoldWatchContractEvent({
  contractName: "Redemption",
  eventName: "Redeemed",
  onLogs: (logs) => console.log(logs),
});
```

Other hooks: `useScaffoldEventHistory`, `useDeployedContractInfo`, `useTargetNetwork`

### Key Pages & Hooks

| Path | Description |
|------|-------------|
| `core/app/trade/page.tsx` | Main trading page |
| `core/app/trade/components/OptionsGrid.tsx` | Options chain (strikes x expirations, calls/puts) |
| `core/app/trade/components/TradePanel.tsx` | Order entry panel |
| `core/app/trade/hooks/useTradableOptions.ts` | Fetches options from OptionCreated events |
| `core/app/trade/hooks/useBebopQuote.ts` | Fetch quote from Bebop |
| `core/app/trade/hooks/useBebopTrade.ts` | Execute trade via Bebop |
| `core/app/options/page.tsx` | Alternative trading interface |
| `core/app/options/components/OptionsGrid.tsx` | Options grid (separate implementation) |
| `core/app/options/hooks/useRfqPricingStream.ts` | RFQ pricing WebSocket |
| `core/app/options/hooks/useRfqQuote.ts` | RFQ quote hook |
| `core/app/mint/page.tsx` | Minting interface |
| `core/app/hooks/usePricingStream.ts` | WebSocket connection for live prices |
| `core/app/contexts/PricingContext.tsx` | Pricing React context |
| `core/app/lib/WebSocketManager.ts` | WebSocket connection manager |
| `core/app/lib/PricingStreamManager.ts` | Pricing stream manager |
| `core/app/lib/RfqPricingStreamManager.ts` | RFQ pricing stream manager |

### Strike Normalization in Frontend

Same logic as market-maker - invert put strikes to align with calls:
```typescript
if (option.isPut && option.strike > 0n) {
  normalizedStrike = (10n ** 36n) / option.strike;
}
```

---

## Market Maker Package (`market-maker/`)

Consolidated TypeScript service providing liquidity through three modes.

### Package Structure

```
market-maker/
├── src/
│   ├── direct.ts              # Entry: standalone quote server
│   ├── bebop.ts               # Entry: Bebop RFQ client
│   ├── relay.ts               # Entry: Bebop price relay
│   ├── modes/                 # Mode implementations
│   │   ├── direct.ts          # HTTP + WebSocket quote server
│   │   ├── bebop.ts           # Bebop RFQ handler
│   │   └── relay.ts           # Bebop price relay
│   ├── pricing/               # Pricing core (shared)
│   │   ├── blackScholes.ts    # Black-Scholes with Greeks
│   │   ├── pricer.ts          # Pricing engine
│   │   ├── spotFeed.ts        # On-chain spot price feed
│   │   └── types.ts
│   ├── servers/               # Server implementations
│   │   ├── httpApi.ts         # Express HTTP quote API
│   │   ├── wsStream.ts        # WebSocket price broadcast
│   │   └── wsRelay.ts         # WebSocket relay server
│   ├── bebop/                 # Bebop integration
│   │   ├── client.ts          # RFQ WebSocket client
│   │   ├── relay.ts           # Pricing relay (uses takerPricing protobuf)
│   │   ├── pricingStream.ts   # Protobuf pricing stream to Bebop
│   │   ├── signing.ts         # Quote signing
│   │   ├── types.ts
│   │   └── proto/             # Protobuf definitions
│   │       ├── pricing.proto
│   │       ├── pricing_pb.js / .d.ts       # PMM pricing (outbound)
│   │       └── takerPricing_pb.js / .d.ts  # Taker pricing (inbound relay)
│   └── config/                # Chain/token configuration
│       ├── chains.ts          # Multi-chain support (Ethereum, Base, Arbitrum, Unichain + testnets)
│       ├── tokens.ts          # Token addresses per chain
│       ├── options.ts         # Option deployment tracking
│       ├── metadata.ts        # Fetch/cache option params from chain
│       ├── registry.ts        # Option address registry
│       ├── client.ts          # RPC client factory (singleton)
│       ├── ports.ts           # Port configuration
│       └── index.ts
├── data/                      # Cached metadata
│   └── metadata-1.json        # Ethereum option metadata
├── Dockerfile                 # Multi-stage build (node:25-alpine)
├── docker-compose.yml         # Runs bebop + relay services
├── package.json
├── tsup.config.ts             # Build config → dist/{direct,bebop,relay}.mjs
└── tsconfig.json
```

### Environment Variables

**Common** (all modes):
```bash
CHAIN_ID=8453              # Default chain (1=Ethereum, 8453=Base, 42161=Arbitrum, 130=Unichain)
MAKER_ADDRESS=0x...
PRIVATE_KEY=0x...          # For signing quotes
```

**Direct Mode** (standalone quote server):
```bash
HTTP_PORT=3010             # HTTP API port
WS_PORT=3011               # WebSocket stream port
DEFAULT_IV=0.8             # Implied volatility
RISK_FREE_RATE=0.05        # Risk-free rate
BID_SPREAD=0.02            # Bid spread (2%)
ASK_SPREAD=0.02            # Ask spread (2%)
SPOT_POLL_INTERVAL=30000   # Spot price update interval (ms)
PRICE_BROADCAST_INTERVAL=5000  # WebSocket broadcast interval
```

**Bebop Mode** (RFQ client):
```bash
BEBOP_MARKETMAKER=xxx      # Bebop market maker ID
BEBOP_AUTHORIZATION=xxx    # Bebop auth token
BEBOP_API_URL=https://api.bebop.xyz
CHAIN=ethereum             # Chain name for Bebop
```

**Relay Mode** (price relay):
```bash
RELAY_WS_PORT=3004         # WebSocket relay port
BEBOP_CHAINS=ethereum,base,arbitrum  # Chains to relay
```

### Pricing Core

**Black-Scholes** (`pricing/blackScholes.ts`):
```typescript
blackScholesPrice({ spot, strike, timeToExpiry, volatility, riskFreeRate, isPut }): {
  price, delta, gamma, theta, vega
}
calculateBidAsk(spot, strike, expirationTimestamp, isPut, volatility, riskFreeRate, spreadPercent): { bid, ask }
```

**Critical put normalization**: put price per token = BS price / strike

**Spot Feed** (`pricing/spotFeed.ts`): Chainlink price feeds, fallback to Uniswap V3 TWAP.

### Bebop Integration

Two WebSocket connections:
1. **RFQ** (`bebop/client.ts`): Receives quote requests, responds with signed quotes
2. **Pricing Stream** (`bebop/pricingStream.ts`): Sends prices to Bebop every 10s via Protobuf

The **Relay** (`bebop/relay.ts`) connects to Bebop's *taker* pricing feeds (protobuf) and re-broadcasts filtered option prices to local WebSocket clients.

### Metadata Caching

```bash
yarn fetch-metadata    # Fetch from chain, save to data/metadata-{chainId}.json
```
Services auto-load cached metadata (~5ms) or fall back to chain fetch (~500ms+).

### Centralized RPC Client

All chain calls go through `config/client.ts`:
```typescript
import { getPublicClient, getWalletClient } from "./config/client";
```
Override RPC URLs with `RPC_ETHEREUM`, `RPC_BASE`, `RPC_ARBITRUM`, etc.

---

## Configuration Files

- `core/scaffold.config.ts`: Frontend network configuration, target networks
- `.env` / `.env.local`: Private keys, API keys (never commit)
- `market-maker/.env`: Market maker secrets
- `abi/deployedContracts.ts`: Auto-generated contract addresses and ABIs

## Key Dependencies

- **Next.js**: Frontend framework (App Router)
- **Scaffold-ETH 2**: Web3 development framework (hooks, components)
- **RainbowKit + Wagmi + Viem**: Wallet connection and contract interaction
- **Tailwind CSS**: Styling
- **tsup**: Market maker bundler
- **protobufjs**: Bebop protocol buffers
- **express + ws**: Market maker HTTP/WebSocket servers

## Naming Conventions

- Contracts use PascalCase: `Option`, `Redemption`, `OptionFactory`
- Contract functions use camelCase: `mint`, `exercise`, `toConsideration`
- Internal contract functions use trailing underscore: `mint_`, `redeem_`
- State variables use camelCase: `collateral`, `consideration`, `expirationDate`
