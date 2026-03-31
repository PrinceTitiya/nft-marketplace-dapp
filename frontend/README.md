# Frontend — NFT Marketplace

The frontend is a **Next.js 13** web application that connects to the `NftMarketplace` smart contract deployed on Ethereum (Hardhat localhost or Sepolia). It allows users to browse listings, buy NFTs, list their own NFTs, manage listings, and withdraw ETH proceeds — all directly from the browser.

---

## Table of Contents

- [Tech Stack & Libraries](#tech-stack--libraries)
- [Folder Structure](#folder-structure)
- [Application Entry Point — `_app.js`](#application-entry-point--_appjs)
- [Pages](#pages)
  - [Home Page — `index.js`](#home-page--indexjs)
  - [Sell NFT Page — `sell-nft.js`](#sell-nft-page--sell-nftjs)
- [Components](#components)
  - [Header — `Header.js`](#header--headerjs)
- [Constants](#constants)
- [GraphQL Subgraph Integration](#graphql-subgraph-integration)
  - [Active Listings Query (index.js)](#active-listings-query-indexjs)
  - [Buy Flow and UI Refresh](#buy-flow-and-ui-refresh)
- [IPFS Metadata Resolution](#ipfs-metadata-resolution)
- [Wallet & Chain Management](#wallet--chain-management)
- [Running the Frontend](#running-the-frontend)

---

## Tech Stack & Libraries

| Library | Version | Role |
|---------|---------|------|
| **Next.js** | `13.5.6` | React framework — page routing, SSR |
| **React** | `18.2.0` | UI component library |
| **Wagmi** | `^2.16.9` | React hooks for reading/writing to Ethereum contracts |
| **RainbowKit** | `^2.2.8` | Pre-built wallet connect UI (MetaMask, Coinbase, WalletConnect, etc.) |
| **ethers.js** | `^6.15.0` | Ethereum utilities — formatting wei, signing transactions |
| **graphql-request** | `^7.4.0` | GraphQL client for The Graph/subgraph queries |
| **@tanstack/react-query** | `^5.85.8` | Async data caching layer required by Wagmi v2 |
| **TailwindCSS** | `^3.0.24` | Utility-first CSS for styling |

### Why Wagmi?

Wagmi provides **typed React hooks** for every on-chain action without manually managing providers or signers. Key hooks used in this project:

| Hook | Used In | What It Does |
|------|---------|-------------|
| `usePublicClient` | `index.js` | Gets a read-only client to call view functions |
| `useWriteContract` | `index.js` | Sends a write transaction (buy NFT) |
| `useAccount` | `index.js`, `sell-nft.js`, `Header.js` | Gets the connected wallet address and connection status |
| `useWalletClient` | `sell-nft.js` | Gets the signer-enabled wallet client for write transactions |
| `useChainId` | `index.js`, `Header.js` | Gets the currently connected chain ID |


---

## Folder Structure

```
frontend/
├── pages/
│   ├── _app.js          # Root: providers (Wagmi, RainbowKit, React Query)
│   ├── index.js         # Home: browse & buy listed NFTs
│   └── sell-nft.js      # Sell: list / cancel / update / withdraw
│
├── components/
│   └── Header.js        # Navbar with wallet connect & navigation
│
├── constants/
│   ├── networkMapping.json # Contract addresses by `chainId` (marketplace + NFT)
│   ├── marketplace.json # NftMarketplace ABI
│   └── BasicNft.json    # BasicNft ABI
│
└── styles/
    └── globals.css      # Global TailwindCSS styles
```

---

## Application Entry Point — `_app.js`

> `pages/_app.js` is Next.js's root component — it wraps every page.

This file sets up the entire **Web3 context** using three nested providers:

```jsx
<WagmiProvider config={config}>          // Wagmi: contract reads/writes/events
  <QueryClientProvider client={queryClient}> // React Query: async state
    <RainbowKitProvider>                 // RainbowKit: wallet UI
      <Header />
      <Component {...pageProps} />       // Actual page content
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### Supported Networks

Two chains are configured — the app works on both without changes:

```js
// Custom Hardhat localhost chain (for local development)
const hardhat = {
  id: 31337,
  name: "Hardhat Localhost",
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
}

// Sepolia testnet (for public testing)
import { sepolia } from "wagmi/chains"

const config = getDefaultConfig({
  appName: "NFT Marketplace",
  chains: [hardhat, sepolia],
})
```

---

## Pages

### Home Page — `index.js`

**Route:** `/`

The home page fetches the marketplace's **active listings** from the GraphQL subgraph (The Graph), then resolves each NFT's display metadata (name + image) from the NFT contract's `tokenURI()`.

#### Startup Data Flow

```
Component mounts
      │
      ▼
useListings(page) runs (React Query)
      │
      ▼
GraphQL request to SUBGRAPH_URL
  - query: activeItems(first, skip, orderBy: tokenId)
  - variables: first=20, skip=page*20
      │
      ▼
Render listings grid (seller, nftAddress, tokenId, price)

For each listing
      │
      ▼
fetchNftMetadata(nftAddress, tokenId)
  ├─► publicClient.readContract("tokenURI", [tokenId])
  └─► resolve ipfs:// → https://ipfs.io/ipfs/
      │
      ▼
Fetch metadata JSON and display `name` + `image`
```

#### Buy Flow

When a user clicks **"Buy Now"**:

```js
writeContract({
  address: marketplaceAddress,
  abi: marketplaceAbi,
  functionName: "buyItem",
  args: [listing.nftAddress, listing.tokenId],
  value: listing.price,   // sends ETH equal to listing price
})
```

After `writeContract(...)` resolves, the page calls `refetch()` to reload `activeItems` from the subgraph.
The purchased card disappears once the subgraph has indexed the emitted `ItemBought` event.

---

### Sell NFT Page — `sell-nft.js`

**Route:** `/sell-nft`

The seller dashboard. It supports four actions:

#### 1. List NFT

```
User fills: NFT address, Token ID, Price (ETH)
      │
      ▼
Check if already listed:
  marketplaceContract.getListing(nftAddress, tokenId)
  → if listing.price > 0: show warning, stop
      │
      ▼
Step 1 — Approve the marketplace to transfer the NFT:
  nftContract.approve(marketplaceAddress, tokenId)
  await tx.wait()
      │
      ▼
Step 2 — List on the marketplace:
  marketplaceContract.listItem(nftAddress, tokenId, priceInWei)
  await tx.wait()
      │
      ▼
Toast: "NFT Listed Successfully!"
```

> The `approve()` call is critical — without it, `listItem()` will revert with `NftMarketplace__NotApprovedForMarketplace`.

#### 2. Cancel Listing

```
User fills: NFT address, Token ID
      │
      ▼
Confirmation modal appears ("Are you sure?")
      │
      ▼  [Yes]
Check if listed:
  getListing(cancelNftAddress, cancelTokenId)
  → if listing.price == 0: show "not listed" warning, stop
      │
      ▼
marketplaceContract.cancelListing(cancelNftAddress, cancelTokenId)
  await tx.wait()
      │
      ▼
Toast: "NFT successfully canceled!"
Tx confirmed; the seller status is updated after `cancelListing()` completes.
```

#### 3. Update Listing Price

```
User fills: NFT address, Token ID → clicks "Check Listing"
      │
      ▼
getListing(updateNftAddress, updateTokenId)
  → if price > 0: show current price + seller
  → else: "This NFT is not listed"
      │
      ▼ (listing found)
User enters new price → clicks "Update Price"
      │
      ▼
marketplaceContract.updateListing(nftAddress, tokenId, newPriceInWei)
  await tx.wait()
      │
      ▼
Toast: "Listing updated successfully!"
UI refreshes to show new price
```

#### 4. Withdraw Proceeds

```
User clicks "Check Balance"
      │
      ▼
marketplaceContract.getProceeds(walletAddress)
  → returns: accumulated ETH from past sales (in wei)
setProceeds(ethers.formatEther(userProceeds))   // display in ETH
      │
      ▼ (if balance > 0)
User clicks "Withdraw"
      │
      ▼
marketplaceContract.withdrawProceeds()
  await tx.wait()
      │
      ▼
Toast: "Withdrawal Successful!"
fetchProceeds() refreshes balance to 0
```

#### Toast Notification System

`sell-nft.js` includes a custom floating toast system that provides real-time feedback:

```js
const showToast = (message, type, duration = 4500) => {
  setToast({ message, type, visible: true })
  // auto-hides after 4.5 seconds
}
```

Toast type is inferred from message content: `✅` → success (green), `❌` → error (red), `⚠️` → info (yellow).

---

## Components

### Header — `Header.js`

The navigation bar rendered on every page (via `_app.js`).

**Features:**
- **Navigation links:** `Home` (`/`) and `Sell NFT` (`/sell-nft`)
- **RainbowKit `<ConnectButton />`:** One-click wallet connection modal supporting MetaMask, Coinbase Wallet, WalletConnect, and more
- **Auto chain switching:** Detects the connected chain and auto-switches to Sepolia if the user is on an unsupported network

```js
useEffect(() => {
  if (!isConnected) return
  // If not on Hardhat (31337) or Sepolia (11155111), switch to Sepolia
  if (chainId !== 31337 && chainId !== 11155111) {
    switchChain({ chainId: 11155111 })
  }
}, [isConnected, chainId, switchChain])
```

---

## Constants

### `constants/networkMapping.json`

Holds the deployed contract addresses keyed by `chainId` (used by both `index.js` and `sell-nft.js`). **Update these after each deployment:**

```json
{
  "31337": {
    "NftMarketplace": ["0x5FbDB2315678afecb367f032d93F642f64180aa3"],
    "BasicNft": ["0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"]
  },
  "11155111": {
    "NftMarketplace": ["0x26a2AC1BB50B0Cf5A9614a5761CFf6fF19B72D73"],
    "BasicNft": ["0xeE8b7d1229738b4F744E576b0fc13D786d6E8776"]
  }
}
```

### `constants/marketplace.json`

The ABI (Application Binary Interface) for `NftMarketplace.sol`. It tells ethers.js / wagmi the exact function signatures and event schemas so they can encode/decode on-chain data.

### `constants/BasicNft.json`

The ABI for `BasicNft.sol`. Used to call `tokenURI()`, `getTokenCounter()`, and `approve()`.

---

## GraphQL Subgraph Integration

The home page (`frontend/pages/index.js`) uses a GraphQL subgraph (The Graph) as its read-optimized backend for marketplace listings.
Instead of scanning contract state directly in the browser, the subgraph indexes contract events and maintains the current set of `ActiveItem` records.

### Active Listings Query (index.js)

`index.js` defines:
- `SUBGRAPH_URL`: `https://api.studio.thegraph.com/query/102524/nft-marketplace/version/latest`
- `GET_ACTIVE_ITEMS`: a GraphQL query that requests `activeItems(first, skip, orderBy: tokenId)` (fields: `id`, `seller`, `nftAddress`, `tokenId`, `price`)

`useListings(page)` wraps the query with React Query and paginates with:
- `first: 20`
- `skip: page * 20`

The subgraph keeps `activeItems` in sync by:
- Creating/updating `ActiveItem` when `ItemListed` fires (`handleItemListed`)
- Removing `ActiveItem` when `ItemBought` or `ItemCanceled` fires (`handleItemBought`, `handleItemCanceled`)

### Buy Flow and UI Refresh

When the user clicks **"Buy Now"**, the page calls `buyItem(nftAddress, tokenId)` on `NftMarketplace` via `writeContract`.
Afterward, the page calls `refetch()` to reload `activeItems` from the subgraph.

Because the subgraph indexes events asynchronously, the UI may update slightly after the transaction is confirmed.

---

## IPFS Metadata Resolution

NFT metadata is stored on IPFS. Browsers cannot resolve `ipfs://` URIs natively, so the frontend converts them to HTTP gateway URLs:

```js
function resolveIpfsUri(uri) {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/")
  }
  return uri
}
```

Full metadata fetch flow:

```js
async function fetchNftMetadata(publicClient, nftAddr, tokenId) {
  // 1. Call tokenURI(tokenId) on the NFT contract
  const tokenUri = await publicClient.readContract({
    address: nftAddr,
    abi: nftAbi,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  })

  // 2. Convert ipfs:// → https://ipfs.io/ipfs/
  const httpUrl = resolveIpfsUri(tokenUri)

  // 3. Fetch the JSON metadata
  const response = await fetch(httpUrl)
  const metadata = await response.json()
  // metadata = { name: "PUG", image: "ipfs://..." }

  // 4. Also convert the image URI
  return {
    name: metadata.name,
    image: resolveIpfsUri(metadata.image),
  }
}
```

The resolved image URL is then used directly in an `<img>` tag. An image error fallback is included in the UI in case the IPFS gateway is slow or unavailable.

---

## Wallet & Chain Management

RainbowKit wraps the wallet connection experience. It supports:
- **MetaMask**
- **Coinbase Wallet**
- **WalletConnect** (mobile wallets via QR code)
- **Injected wallets** (Brave, Frame, etc.)

The `ConnectButton` component in `Header.js` shows:
- Wallet address (shortened) when connected
- Current chain icon
- A "Connect Wallet" button when disconnected

Chain switching is automatic — if a user connects on an unsupported chain, the `Header.js` `useEffect` triggers `switchChain({ chainId: 11155111 })` to move them to Sepolia.

---

## Running the Frontend

```bash
# From the frontend/ directory
yarn install

# Start dev server
yarn dev
```

Create `frontend/.env.local` with at least:
- `NEXT_PUBLIC_PROJECT_ID` (required by RainbowKit)

Open [http://localhost:3000](http://localhost:3000).

Make sure the contracts are deployed and `constants/networkMapping.json` has the correct deployed addresses (by chainId) before starting the frontend.

> For local development: run `npx hardhat node` and `npx hardhat deploy --network localhost` from the **project root** first.