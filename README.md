# NFT Marketplace DApp

A **fully decentralized NFT Marketplace** built with Solidity, Hardhat, and a Next.js frontend. Sellers can list, update, and cancel NFT listings. Buyers can browse and purchase NFTs directly on-chain — no custodian, no middleman. Proceeds are held in the contract and can be withdrawn at any time by the seller(owner).

---

## Table of Contents

-   [Features](#-features)
-   [Architecture Overview](#-architecture-overview)
-   [Project Structure](#-project-structure)
-   [Smart Contracts](#-smart-contracts)
    -   [NftMarketplace.sol](#nftmarketplacesol)
    -   [BasicNft.sol (Test NFT)](#basicnftsol-test-nft)
-   [Frontend](#-frontend)
    -   [Pages](#pages)
    -   [Components](#components)
    -   [Event Handling](#event-handling)
-   [Deploy Scripts](#-deploy-scripts)
-   [Testing](#-testing)
-   [Quick Setup Guide](#-quick-setup-guide)
    -   [Prerequisites](#prerequisites)
    -   [1. Clone the Repository](#1-clone-the-repository)
    -   [2. Backend Setup](#2-backend-setup-hardhat)
    -   [3. Configure Environment Variables](#3-configure-environment-variables)
    -   [4. Deploy Contracts Locally](#4-deploy-contracts-locally)
    -   [5. Mint & List an NFT](#5-mint--list-an-nft)
    -   [6. Run the Frontend](#6-run-the-frontend)
    -   [7. Deploy to Sepolia Testnet](#7-deploy-to-sepolia-testnet)
-   [Interacting with the Contract](#-interacting-with-the-contract)
-   [IPFS & NFT Metadata](#-ipfs--nft-metadata)
-   [Tech Stack](#-tech-stack)
-   [Scripts & Commands Reference](#-scripts--commands-reference)

---

## Features

-   **List NFTs** — Owners can list any ERC-721 NFT for sale at a custom ETH price
-   **Buy NFTs** — Anyone can purchase a listed NFT by sending the exact ETH amount
-   **Cancel Listings** — Sellers can remove their NFT from the marketplace anytime
-   **Update Listings** — Sellers can change the price of their listed NFT
-   **Withdraw Proceeds** — Sellers collect their ETH earnings via a secure withdrawal pattern
-   **Reentrancy Protection** — Uses OpenZeppelin's `ReentrancyGuard` for secure payments
-   **IPFS Metadata** — NFT images and metadata are fetched from IPFS and displayed in the UI
-   **Real-time Updates** — Frontend listens to on-chain events (`ItemListed`, `ItemBought`, `ItemCanceled`) to update the UI instantly
-   **RainbowKit Wallet** — Seamless wallet connection with support for Hardhat localhost and Sepolia

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    NFT Marketplace DApp                │
├────────────────────┬───────────────────────────────────┤
│   Smart Contracts  │          Frontend (Next.js)       │
│  (Hardhat/Solidity)│                                   │
│                    │  ┌─────────────────────────────┐  │
│  NftMarketplace    │  │  _app.js (Wagmi + RainbowKit)│ │
│  ────────────────  │  ├─────────────────────────────┤  │
│  • listItem()      │  │  index.js (Browse & Buy)    │  │
│  • buyItem()       │  ├─────────────────────────────┤  │
│  • cancelListing() │  │  sell-nft.js                │  │
│  • updateListing() │  │  (List / Cancel / Update /  │  │
│  • withdrawProceeds│  │   Withdraw Proceeds)        │  │
│                    │  ├─────────────────────────────┤  │
│  BasicNft (ERC721) │  │  Header.js (Navigation +    │  │
│  ────────────────  │  │  ConnectButton)             │  │
│  • mintNft()       │  └─────────────────────────────┘  │
│  • tokenURI()      │                                   │
└────────────────────┴───────────────────────────────────┘
           │                          │
           └─────── Ethereum ─────────┘
                  (Hardhat / Sepolia)
```

The marketplace **never** holds custody of the NFT. The NFT stays in the owner's wallet; only the marketplace approval is required. ETH paid by buyers is accumulated in the contract and pulled by sellers via `withdrawProceeds()` (pull-over-push pattern).

---

## Project Structure

```
NFT-Marketplace/
│
├── contracts/
│   ├── NftMarketplace.sol         # Core marketplace smart contract
│   └── test/
│       └── BasicNft.sol           # ERC-721 NFT used for local testing
│
├── deploy/
│   ├── 01-deploy-nft-marketplace.js   # Deploys NftMarketplace contract
│   └── 02-deploy-basic-nft.js         # Deploys BasicNft contract
│
├── scripts/
│   └── mint-and-list.js           # Mints a BasicNft and lists it on the marketplace
│
├── test/
│   └── unit/
│       └── NftMarketplace.test.js # Comprehensive unit tests
│
├── utils/
│   └── verify.js                  # Etherscan contract verification helper
│
├── frontend/
│   ├── pages/
│   │   ├── _app.js                # App root: Wagmi + RainbowKit providers
│   │   ├── index.js               # Home page: browse & buy listed NFTs
│   │   └── sell-nft.js            # Sell page: list / cancel / update / withdraw
│   ├── components/
│   │   └── Header.js              # Navbar with wallet connect & chain switching
│   ├── constants/
│   │   ├── network.js             # Contract addresses (marketplace + NFT)
│   │   ├── marketplace.json       # NftMarketplace ABI
│   │   └── BasicNft.json          # BasicNft ABI
│   └── styles/
│       └── globals.css            # Global TailwindCSS styles
│
├── hardhat.config.js              # Hardhat config (networks, Solidity, gas reporter)
├── helper-hardhat-config.js       # Chain-specific config (chainId, VRF, price feed)
├── package.json                   # Root package (Hardhat dev dependencies)
└── .env                           # Environment variables (not committed)
```

---

## 📄 Smart Contracts

### `NftMarketplace.sol`

> **Location:** `contracts/NftMarketplace.sol`  
> **Solidity:** `^0.8.7` | Inherits: `ReentrancyGuard` (OpenZeppelin)

This is the core contract that powers the marketplace. It manages NFT listings, purchases, cancellations, price updates, and ETH proceeds.

#### Data Structures

```solidity
struct Listing {
    uint256 price;   // Price in wei
    address seller;  // Address of the NFT owner
}

// NFT contract address → Token ID → Listing
mapping(address => mapping(uint256 => Listing)) private s_listings;

// Seller address → ETH accumulated from sales
mapping(address => uint256) private s_proceeds;
```

#### Events

| Event                                            | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| `ItemListed(seller, nftAddress, tokenId, price)` | Emitted when an NFT is listed or its price is updated |
| `ItemBought(buyer, nftAddress, tokenId, price)`  | Emitted when an NFT is successfully purchased         |
| `ItemCanceled(seller, nftAddress, tokenId)`      | Emitted when a listing is canceled                    |

#### Custom Errors

| Error                                       | When Thrown                                  |
| ------------------------------------------- | -------------------------------------------- |
| `NftMarketplace__PriceMustBeAboveZero`      | Price is set to 0 or negative                |
| `NftMarketplace__NotApprovedForMarketplace` | Marketplace not approved to transfer the NFT |
| `NftMarketplace__AlreadyListed`             | NFT is already listed                        |
| `NftMarketplace__NotOwner`                  | Caller is not the NFT owner                  |
| `NftMarketplace__NotListed`                 | NFT is not currently listed                  |
| `NftMarketplace__PriceNotMet`               | ETH sent is less than the listing price      |
| `NftMarketplace__NoProceeds`                | Seller has no ETH proceeds to withdraw       |
| `NftMarketplace__TransferFailed`            | ETH transfer to seller failed                |

#### Functions

| Function                                       | Visibility         | Description                                                         |
| ---------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| `listItem(nftAddress, tokenId, price)`         | `external`         | Lists an NFT for sale. Requires marketplace approval and ownership. |
| `buyItem(nftAddress, tokenId)`                 | `external payable` | Purchases a listed NFT. Sends ETH to seller's proceeds balance.     |
| `cancelListing(nftAddress, tokenId)`           | `external`         | Removes an NFT listing. Only callable by the owner.                 |
| `updateListing(nftAddress, tokenId, newPrice)` | `external`         | Updates the price of an active listing.                             |
| `withdrawProceeds()`                           | `external`         | Withdraws all accumulated ETH proceeds for the caller.              |
| `getListing(nftAddress, tokenId)`              | `external view`    | Returns the `Listing` struct for a given NFT.                       |
| `getProceeds(seller)`                          | `external view`    | Returns the accumulated ETH balance for a seller.                   |

#### Modifiers

| Modifier                                | Purpose                                   |
| --------------------------------------- | ----------------------------------------- |
| `notListed(nftAddress, tokenId, owner)` | Ensures NFT is not already listed         |
| `isOwner(nftAddress, tokenId, spender)` | Ensures caller is the ERC-721 token owner |
| `isListed(nftAddress, tokenId)`         | Ensures NFT has an active listing         |

> **Security Note:** `buyItem` is protected by `nonReentrant` (OpenZeppelin). ETH proceeds follow the **pull-over-push** pattern — sellers must explicitly call `withdrawProceeds()` — which prevents reentrancy attacks during buy transactions.

---

### `BasicNft.sol` (Test NFT)

> **Location:** `contracts/test/BasicNft.sol`  
> **Solidity:** `^0.8.7` | Inherits: `ERC721` (OpenZeppelin)

A minimal ERC-721 contract used for local testing and development. It mints NFTs with a hardcoded IPFS token URI (a PUG image metadata JSON).

```solidity
string public constant TOKEN_URI =
    "ipfs://bafybeig37ioir76s7mg5oobetncojcm3c3hxasyd4rvid4jqhy4gkaheg4/?filename=0-PUG.json";
```

| Function            | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `mintNft()`         | Mints a new NFT to the caller and increments the token counter |
| `tokenURI(tokenId)` | Returns the IPFS metadata URI for a given token                |
| `getTokenCounter()` | Returns total number of minted tokens                          |

-   **Token Name:** `Dogie`
-   **Token Symbol:** `DOG`
-   **Event:** `DogMinted(tokenId)` — emitted on each mint

---

## Frontend

> **Location:** `frontend/`  
> **Framework:** Next.js 13 with TailwindCSS  
> **Web3:** Wagmi v2 + RainbowKit v2 + ethers.js v6

### Pages

#### `index.js` — Home / Browse Listings

The main page that shows all active NFT listings and allows users to buy them.

**How it works:**

1. **On mount:** Calls `getTokenCounter()` on `BasicNft` to know how many NFTs exist, then iterates through each token ID calling `getListing()` on the marketplace. If a listing has a non-zero seller address, it is added to the display list.
2. **Metadata fetch:** For each listed NFT, `tokenURI()` is called, the IPFS URI is converted to an HTTP gateway URL (`ipfs://` → `https://ipfs.io/ipfs/`), and the metadata JSON is fetched to display the name and image.
3. **Real-time events:** Uses `useWatchContractEvent` to listen for:
    - `ItemListed` — adds newly listed NFTs to the grid without a page refresh
    - `ItemBought` — removes sold NFTs from the grid automatically
4. **Buy flow:** Clicking "Buy Now" calls `buyItem(nftAddress, tokenId)` on the marketplace contract with the exact listing price as `msg.value`.

#### `sell-nft.js` — Sell / Manage NFTs

The dashboard for sellers to manage their NFTs and proceeds.

**Sections:**

-   **List NFT:** Enter NFT contract address, token ID, and price in ETH → approves the marketplace, then calls `listItem()`
-   **Cancel Listing:** Enter NFT address and token ID → shows a confirmation modal → calls `cancelListing()`
-   **Update Listing:** Look up an existing listing by address/token ID → displays current price → allows entering a new price and calling `updateListing()`
-   **Proceeds:** Shows accumulated ETH balance by calling `getProceeds(address)` → "Withdraw" calls `withdrawProceeds()`

**Toast Notifications:** A floating toast notification system displays real-time feedback (success , error , info ) for all contract interactions.

**Events watched:**

-   `ItemCanceled` — confirms cancellation of a specific listing in real time

### Components

#### `Header.js`

-   Displays the site title "NFT Marketplace" and navigation links (`Home`, `Sell NFT`)
-   Includes the **RainbowKit** `ConnectButton` for wallet connection
-   Automatically detects unsupported chains and switches the user to **Sepolia** as default
-   Supports both **Hardhat localhost (31337)** and **Sepolia (11155111)**

### Event Handling

The frontend uses Wagmi's `useWatchContractEvent` hook to subscribe to on-chain events in real time:

```
ItemListed  ──▶  index.js: adds NFT card to the marketplace grid
ItemBought  ──▶  index.js: removes NFT card when sold
ItemCanceled ─▶  sell-nft.js: confirms listing cancellation to the seller
```

This eliminates the need for page refreshes — the UI stays in sync with the blockchain automatically.

---

## Deploy Scripts

### `deploy/01-deploy-nft-marketplace.js`

Deploys the `NftMarketplace` contract using `hardhat-deploy`. On non-development chains with an Etherscan API key set, it automatically verifies the contract on Etherscan.

**Tags:** `all`, `nftmarketplace`

### `deploy/02-deploy-basic-nft.js`

Deploys the `BasicNft` ERC-721 contract. Also auto-verifies on Etherscan when not on a development chain.

**Tags:** `all`, `basicNft`

Both scripts use the `deployer` named account (account index 0) defined in `hardhat.config.js`.

---

## Testing

> **Location:** `test/unit/NftMarketplace.test.js`  
> **Framework:** Hardhat + Chai + Waffle  
> **Only runs on:** development chains (`hardhat`, `localhost`)

The test suite covers all core contract functions:

| `describe` block       | Tests                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`listItem`**         | Emits `ItemListed`; reverts on double-listing, zero price, missing approval; stores listing data correctly |
| **`buyItem`**          | Reverts on unlisted NFT; reverts if price not met; transfers NFT to buyer and updates proceeds             |
| **`updateListing`**    | Reverts if not owner or not listed; reverts on zero new price; updates price and emits `ItemListed`        |
| **`withdrawProceeds`** | Reverts if no proceeds; withdraws correct ETH amount accounting for gas costs                              |
| **`cancelListing`**    | Emits `ItemCanceled` on successful cancellation                                                            |

Each `beforeEach` hook:

-   Deploys both contracts fresh using `deployments.fixture(["all"])`
-   Mints one `BasicNft` token
-   Approves the marketplace contract to transfer token ID 0

---

## Quick Setup Guide

### Prerequisites

Ensure you have the following installed:

-   [Node.js](https://nodejs.org/) v16+
-   [Yarn](https://yarnpkg.com/)
-   [MetaMask](https://metamask.io/) or any EVM-compatible wallet
-   [Git](https://git-scm.com/)

---

### 1. Clone the Repository

```bash
git clone https://github.com/PrinceTitiya/nft-marketplace-dapp.git

cd nft-marketplace-dapp
```

---

### 2. Backend Setup (Hardhat)

Install root dependencies:

```bash
yarn install
```

---

### 3. Configure Environment Variables

Create a `.env` file at the project root:

```bash
cp .env.example .env   # or create it manually
```

Fill in the following values:

```env
# Required for Sepolia testnet deployment
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Your wallet private key (never commit this!)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Required for Etherscan contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Optional: for gas cost reporting in USD
COINMARKETCAP_API_KEY=YOUR_COINMARKETCAP_API_KEY
```

> ⚠️ **Never share or commit your `.env` file.** It is already in `.gitignore`.

---

### 4. Deploy Contracts Locally

**Start a local Hardhat node** in a separate terminal:

```bash
npx hardhat node
```

This starts a local Ethereum node at `http://127.0.0.1:8545` with 20 pre-funded accounts.

**Deploy both contracts** to the local node:

```bash
npx hardhat deploy --network localhost
```

You'll see output like:

```
deploying "NftMarketplace" ...
NftMarketplace deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
deploying "BasicNft" ...
BasicNft deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

**Update the frontend contract addresses** (`frontend/constants/network.js`) with your deployed addresses:

```js
export const marketplaceAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
export const nftAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
```

---

### 5. Mint & List an NFT

With the local node running and contracts deployed, run the mint-and-list script:

```bash
npx hardhat run scripts/mint-and-list.js --network localhost
```

This script:

1. **Mints** a new `BasicNft` (PUB NFT) to the deployer account
2. **Approves** the marketplace contract to transfer the NFT
3. **Lists** the NFT on the marketplace at **0.1 ETH**

Expected output:

```
Minting....
Approving Nft...
Listing NFT....
Item listed.....
```

---

### 6. Run the Frontend

Navigate to the `frontend/` directory and install dependencies:

```bash
cd frontend
yarn install
```

Start the development server:

```bash
yarn dev
```

Open your browser at [http://localhost:3000](http://localhost:3000).

**Connect your wallet:**

1. Open MetaMask → Add a custom network:
    - **Network Name:** Hardhat Localhost
    - **RPC URL:** `http://127.0.0.1:8545`
    - **Chain ID:** `31337`
    - **Currency Symbol:** ETH
2. Import one of the Hardhat test accounts using its private key (printed by `npx hardhat node`)
3. Click "Connect Wallet" in the header using RainbowKit

You should now see the listed Dog NFT on the home page!

---

### 7. Deploy to Sepolia Testnet

Make sure your `.env` has `SEPOLIA_RPC_URL` and `PRIVATE_KEY` set, and that your wallet has Sepolia ETH (get some from [sepoliafaucet.com](https://sepoliafaucet.com/)).

```bash
npx hardhat deploy --network sepolia
```

This will deploy both contracts and automatically verify them on Etherscan if `ETHERSCAN_API_KEY` is set.

Update `frontend/constants/network.js` with the new Sepolia addresses and rebuild the frontend.

---

## Interacting with the Contract

### Via the Frontend UI

| Action                 | Page                   | How                                                                              |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| Browse all NFTs        | Home (`/`)             | NFT cards load automatically                                                     |
| Buy an NFT             | Home (`/`)             | Click "Buy Now" on any card                                                      |
| List your NFT          | Sell NFT (`/sell-nft`) | Enter NFT address, token ID, price → click "List NFT"                            |
| Cancel a listing       | Sell NFT (`/sell-nft`) | Enter NFT address, token ID → click "Cancel Listing"                             |
| Update listing price   | Sell NFT (`/sell-nft`) | Enter NFT address, token ID → "Check Listing" → enter new price → "Update Price" |
| Check proceeds balance | Sell NFT (`/sell-nft`) | Click "Check Balance"                                                            |
| Withdraw proceeds      | Sell NFT (`/sell-nft`) | Click "Withdraw" (only enabled when balance > 0)                                 |

### Via Hardhat Console

```bash
npx hardhat console --network localhost
```

```js
const marketplace = await ethers.getContract("NftMarketplace")
const basicNft = await ethers.getContract("BasicNft")

// Check a listing
const listing = await marketplace.getListing(basicNft.address, 0)
console.log(listing) // { price: BigNumber, seller: "0x..." }

// Check seller proceeds
const proceeds = await marketplace.getProceeds("0xYOUR_ADDRESS")
console.log(ethers.utils.formatEther(proceeds))
```

---

## IPFS & NFT Metadata

The `BasicNft` contract uses a hardcoded IPFS URI pointing to PUG dog metadata:

```
ipfs://bafybeig37ioir76s7mg5oobetncojcm3c3hxasyd4rvid4jqhy4gkaheg4/?filename=0-PUG.json
```

**To use custom images for your NFTs:**

1. Upload your image to IPFS (e.g., via [Pinata](https://pinata.cloud/) or [NFT.Storage](https://nft.storage/))
2. Create a JSON metadata file:
    ```json
    {
        "name": "My NFT",
        "description": "An awesome NFT",
        "image": "ipfs://YOUR_IMAGE_CID_HERE"
    }
    ```
3. Upload the JSON file to IPFS and get its CID
4. Update `TOKEN_URI` in `BasicNft.sol` to point to your metadata CID:
    ```solidity
    string public constant TOKEN_URI = "ipfs://YOUR_METADATA_CID";
    ```

The frontend automatically resolves `ipfs://` URIs to HTTPS via the public gateway `https://ipfs.io/ipfs/` for browser display.

---

## 🛠️ Tech Stack

### Backend (Hardhat)

| Technology             | Version            | Purpose                            |
| ---------------------- | ------------------ | ---------------------------------- |
| Solidity               | `^0.8.7`           | Smart contract language            |
| Hardhat                | `^2.9.1`           | Development framework & local node |
| hardhat-deploy         | `^0.9.29`          | Deployment management              |
| OpenZeppelin Contracts | `^4.5.0`           | ERC-721, ReentrancyGuard           |
| Chai                   | `^4.3.4`           | Test assertions                    |
| Ethereum Waffle        | `^3.4.0`           | Smart contract testing utilities   |
| ethers.js              | `^5.5.1` (backend) | Ethereum interaction               |
| solidity-coverage      | `0.8.3`            | Code coverage reports              |
| hardhat-gas-reporter   | `^1.0.7`           | Gas cost analysis                  |
| Prettier + solhint     | —                  | Code formatting & linting          |

### Frontend (Next.js)

| Technology            | Version   | Purpose                          |
| --------------------- | --------- | -------------------------------- |
| Next.js               | `13.5.6`  | React framework + SSR            |
| React                 | `18.2.0`  | UI library                       |
| Wagmi                 | `^2.16.9` | React hooks for Ethereum         |
| RainbowKit            | `^2.2.8`  | Wallet connection UI             |
| ethers.js             | `^6.15.0` | Ethereum interaction (frontend)  |
| TailwindCSS           | `^3.0.24` | Utility-first CSS styling        |
| @tanstack/react-query | `^5.85.8` | Async state management for wagmi |

---

## 📋 Scripts & Commands Reference

### Root (Hardhat)

```bash
# Start a local Hardhat node
npx hardhat node

# Compile contracts
npx hardhat compile

# Deploy to localhost
npx hardhat deploy --network localhost

# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Deploy only the marketplace
npx hardhat deploy --network localhost --tags nftmarketplace

# Deploy only BasicNft
npx hardhat deploy --network localhost --tags basicNft

# Run unit tests
npx hardhat test

# Run tests with coverage
yarn coverage

# Mint and list an NFT on localhost
npx hardhat run scripts/mint-and-list.js --network localhost

# Lint Solidity files
yarn lint

# Format all files (Prettier)
yarn format

# Open Hardhat console
npx hardhat console --network localhost
```

### Frontend

```bash
cd frontend

# Install dependencies
yarn install

# Start dev server (http://localhost:3000)
yarn dev
```

---

## License

This project is licensed under the **MIT License**.

---

> Built with using Hardhat, Solidity, Next.js, Wagmi, and RainbowKit.
