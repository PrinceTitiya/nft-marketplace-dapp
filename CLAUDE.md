# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A fully decentralized NFT Marketplace with three layers:
1. **Hardhat backend** — Solidity contracts + deployment + tests (root directory)
2. **Next.js frontend** — React/Wagmi/RainbowKit UI (`frontend/`)
3. **The Graph subgraph** — GraphQL indexer for on-chain events (`subgraph/`)

## Commands

### Hardhat (root)

```bash
yarn install                                          # Install root dependencies
npx hardhat compile                                   # Compile contracts
npx hardhat node                                      # Start local Ethereum node (http://127.0.0.1:8545)
npx hardhat deploy --network localhost                # Deploy all contracts locally
npx hardhat deploy --network sepolia                  # Deploy to Sepolia (verifies on Etherscan automatically)
npx hardhat deploy --network localhost --tags nftmarketplace   # Deploy only marketplace
npx hardhat deploy --network localhost --tags basicNft         # Deploy only BasicNft
npx hardhat test                                      # Run unit tests (hardhat/localhost only)
yarn coverage                                         # Run tests with coverage report
npx hardhat run scripts/mint-and-list.js --network localhost   # Mint + approve + list a BasicNft at 0.1 ETH
npx hardhat console --network localhost               # Interactive console
yarn lint                                             # Lint Solidity files (solhint)
yarn format                                           # Format all files (Prettier)
```

### Frontend (`frontend/`)

```bash
cd frontend
yarn install
yarn dev          # Dev server at http://localhost:3000
```

### Subgraph (`subgraph/`)

```bash
cd subgraph
yarn graph codegen   # Regenerate AssemblyScript types after schema/ABI changes
yarn graph build     # Compile subgraph mappings
graph auth --studio <DEPLOY_KEY>
graph deploy --studio <SUBGRAPH_NAME>
```

## Architecture

### Smart Contracts

**`contracts/NftMarketplace.sol`** — Core marketplace. Uses the pull-over-push pattern: `buyItem()` accumulates ETH into `s_proceeds[seller]` rather than transferring directly; sellers call `withdrawProceeds()` explicitly. The NFT never leaves the owner's wallet — only marketplace approval is required. `buyItem()` is protected by OpenZeppelin `ReentrancyGuard`.

**`contracts/test/BasicNft.sol`** — Minimal ERC-721 used only for local dev/testing. Hardcodes a PUG IPFS metadata URI. Not used in production.

Key mappings in the contract:
- `s_listings[nftAddress][tokenId]` → `Listing{price, seller}`
- `s_proceeds[seller]` → accumulated ETH balance

### Frontend Data Flow

The frontend exclusively queries **The Graph subgraph** for active listings (not direct contract reads). `index.js` sends a `GetActiveItems` GraphQL query to the deployed subgraph endpoint (`SUBGRAPH_URL` hardcoded in `index.js`). NFT images/names are fetched separately by calling `tokenURI()` on each NFT contract and resolving `ipfs://` → `https://ipfs.io/ipfs/`.

The subgraph URL is hardcoded in `frontend/pages/index.js`:
```
https://api.studio.thegraph.com/query/102524/nft-marketplace/version/latest
```

Contract addresses per chain are read from `frontend/constants/networkMapping.json` using the connected `chainId`:
- `31337` (localhost): auto-populated from `deployments/localhost/`
- `11155111` (Sepolia): live deployed addresses

The frontend only supports **Sepolia** in the RainbowKit config (`_app.js`). Localhost (31337) is defined as a custom chain object but is not included in the active `chains` array by default.

### Subgraph

The subgraph (`subgraph/`) indexes events from `NftMarketplace` on Sepolia. It maintains two types of entities:
- **Event history** (`ItemListed`, `ItemBought`, `ItemCanceled`) — immutable append-only records
- **`ActiveItem`** — mutable current state; created on `ItemListed`, removed on `ItemBought` or `ItemCanceled`

The `ActiveItem` ID is `nftAddress-tokenId` (hex address + token ID string). Mappings are in `subgraph/src/nft-marketplace.ts` (AssemblyScript). After any schema or ABI change, run `yarn graph codegen` before editing mappings.

> **Note:** The subgraph is deployed and functional but not yet fully integrated into the frontend for all operations — `sell-nft.js` still uses direct contract reads for some data.

## Environment Variables

Root (`.env`):
```
SEPOLIA_RPC_URL=
PRIVATE_KEY=
ETHERSCAN_API_KEY=
COINMARKETCAP_API_KEY=   # optional, for gas reporting
```

Frontend (`frontend/.env.local`):
```
NEXT_PUBLIC_PROJECT_ID=   # WalletConnect project ID for RainbowKit
```

## Testing Notes

Tests only run on `hardhat` or `localhost` networks — they are skipped automatically on live networks (see the `!developmentChains.includes(network.name) ? describe.skip` guard in the test file). Each `beforeEach` deploys fresh contracts via `deployments.fixture(["all"])`, mints one `BasicNft`, and approves the marketplace for token ID 0.

The `hardhat-deploy` deploy scripts use named accounts: `deployer` = account index 0, `player` = account index 1.
