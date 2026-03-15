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
- [Smart Contract Event Listening](#smart-contract-event-listening)
  - [How Wagmi Watches Events](#how-wagmi-watches-events)
  - [ItemListed Event](#itemlisted-event)
  - [ItemBought Event](#itembought-event)
  - [ItemCanceled Event](#itemcanceled-event)
  - [Full Event Flow Diagram](#full-event-flow-diagram)
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
| **@tanstack/react-query** | `^5.85.8` | Async data caching layer required by Wagmi v2 |
| **TailwindCSS** | `^3.0.24` | Utility-first CSS for styling |

### Why Wagmi?

Wagmi provides **typed React hooks** for every on-chain action without manually managing providers or signers. Key hooks used in this project:

| Hook | Used In | What It Does |
|------|---------|-------------|
| `usePublicClient` | `index.js` | Gets a read-only client to call view functions |
| `useWatchContractEvent` | `index.js`, `sell-nft.js` | Subscribes to on-chain events in real time |
| `useWriteContract` | `index.js` | Sends a write transaction (buy NFT) |
| `useAccount` | `sell-nft.js`, `Header.js` | Gets the connected wallet address and connection status |
| `useWalletClient` | `sell-nft.js` | Gets the signer-enabled wallet client for write transactions |
| `useChainId` | `Header.js` | Gets the currently connected chain ID |
| `useSwitchChain` | `Header.js` | Programmatically switches the wallet to a different chain |

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
│   ├── network.js       # Contract addresses (marketplace + NFT)
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

The main marketplace browse page. It fetches all active NFT listings, loads their IPFS metadata (name + image), and renders them as cards with a "Buy Now" button.

#### Startup Data Flow

```
Component mounts
      │
      ▼
useEffect runs fetchListings()
      │
      ├─► publicClient.readContract("getTokenCounter")
      │         │
      │         ▼
      │   Knows total NFTs minted (e.g. 3)
      │
      ├─► Loop: for tokenId 0..2
      │     publicClient.readContract("getListing", [nftAddress, tokenId])
      │         │
      │         ▼
      │     If listing.seller != address(0)  ← NFT is actively listed
      │         → push to results[]
      │
      ▼
setListings(results)   ← renders NFT cards
      │
      ▼
Loop: for each listing
      fetchNftMetadata(nftAddress, tokenId)
            │
            ├─► readContract("tokenURI", [tokenId])
            │         → returns "ipfs://bafybeig.../0-PUG.json"
            │
            ├─► resolveIpfsUri(tokenUri)
            │         → converts to "https://ipfs.io/ipfs/bafybeig.../0-PUG.json"
            │
            ├─► fetch(httpUrl)
            │         → fetches JSON: { name, description, image: "ipfs://..." }
            │
            └─► resolveIpfsUri(metadata.image)
                      → converts image URI to HTTPS gateway URL
      │
      ▼
setNftMetadata({ tokenId: { name, image, ... } })  ← renders images
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

On success, the smart contract:
1. Transfers the NFT from seller → buyer (`safeTransferFrom`)
2. Credits `msg.value` (ETH) to the seller's `s_proceeds` balance
3. Deletes the listing from `s_listings`
4. Emits `ItemBought` → which the frontend catches to remove the card from the UI

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
Smart contract emits: ItemCanceled
Frontend event listener confirms cancellation in real time
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

### `constants/network.js`

Holds the deployed contract addresses. **Update these after each deployment:**

```js
export const marketplaceAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
export const nftAddress          = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
```

### `constants/marketplace.json`

The ABI (Application Binary Interface) for `NftMarketplace.sol`. It tells ethers.js / wagmi the exact function signatures and event schemas so they can encode/decode on-chain data.

### `constants/BasicNft.json`

The ABI for `BasicNft.sol`. Used to call `tokenURI()`, `getTokenCounter()`, and `approve()`.

---

## Smart Contract Event Listening

This is the core mechanism that keeps the UI in sync with the blockchain **without page refreshes**.

### How Wagmi Watches Events

Wagmi's `useWatchContractEvent` hook opens a persistent subscription to the connected RPC node. Under the hood it uses `eth_subscribe` (WebSocket) or `eth_getLogs` polling (HTTP) to detect new log entries matching the given event signature and contract address.

```js
useWatchContractEvent({
  address: contractAddress,   // which contract to watch
  abi: contractAbi,           // ABI to decode the log data
  eventName: "EventName",     // which event to filter for
  onLogs(logs) {
    // called every time a matching log is emitted on-chain
    logs.forEach(log => {
      const { args } = log   // decoded event arguments
      // update React state here
    })
  }
})
```

---

### `ItemListed` Event

**Emitted by the contract when:**
- A new NFT is listed via `listItem()`
- An existing listing price is updated via `updateListing()`

**Solidity definition:**
```solidity
event ItemListed(
    address indexed seller,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
);
```

**Frontend listener** (`index.js`):
```js
useWatchContractEvent({
  address: marketplaceAddress,
  abi: marketplaceAbi,
  eventName: "ItemListed",

  onLogs(logs) {
    logs.forEach(async (log) => {
      const { args } = log

      const newListing = {
        seller:     args.seller,
        nftAddress: args.nftAddress,
        tokenId:    args.tokenId.toString(),
        price:      args.price.toString(),
      }

      // Add to listings only if not already present (prevent duplicates)
      setListings((prev) => {
        const exists = prev.some(
          l => l.nftAddress === newListing.nftAddress &&
               l.tokenId   === newListing.tokenId
        )
        return exists ? prev : [...prev, newListing]
      })

      // Also fetch IPFS metadata for the newly listed NFT
      const meta = await fetchNftMetadata(publicClient, newListing.nftAddress, newListing.tokenId)
      if (meta) {
        setNftMetadata(prev => ({ ...prev, [newListing.tokenId]: meta }))
      }
    })
  }
})
```

**Effect on UI:** A new NFT card appears in the marketplace grid instantly when someone lists an NFT — no refresh needed.

---

### `ItemBought` Event

**Emitted by the contract when:**
- A buyer successfully purchases an NFT via `buyItem()`

**Solidity definition:**
```solidity
event ItemBought(
    address indexed buyer,
    address indexed nftAddress,
    uint256 tokenId,
    uint256 price
);
```

**Frontend listener** (`index.js`):
```js
useWatchContractEvent({
  address: marketplaceAddress,
  abi: marketplaceAbi,
  eventName: "ItemBought",

  onLogs(logs) {
    logs.forEach((log) => {
      const { args } = log

      const boughtTokenId = args.tokenId.toNumber()
      const nftAddress    = args.nftAddress

      // Remove the sold NFT from the listings grid
      setListings((prev) =>
        prev.filter(
          l => !(l.nftAddress === nftAddress && l.tokenId === boughtTokenId)
        )
      )
    })
  }
})
```

**Effect on UI:** The purchased NFT card disappears from the home page the moment the transaction is confirmed on-chain, for all users viewing the page.

---

### `ItemCanceled` Event

**Emitted by the contract when:**
- A seller cancels their listing via `cancelListing()`

**Solidity definition:**
```solidity
event ItemCanceled(
    address indexed seller,
    address indexed nftAddress,
    uint256 tokenId
);
```

**Frontend listener** (`sell-nft.js`):
```js
useWatchContractEvent({
  address: marketplaceAddress,
  abi: marketplaceAbi,
  eventName: "ItemCanceled",

  onLogs(logs) {
    logs.forEach((log) => {
      const { args } = log

      // Only react if this cancellation was for our address and token
      if (
        args.seller.toLowerCase()     === address?.toLowerCase()    &&
        args.nftAddress.toLowerCase() === cancelNftAddress.toLowerCase() &&
        args.tokenId.toString()       === cancelTokenId
      ) {
        setStatus(`Listing for Token #${args.tokenId} canceled successfully`)
      }
    })
  }
})
```

**Effect on UI:** The seller sees a confirmation status message specific to their token ID, confirming the on-chain cancellation.

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
  // metadata = { name: "PUG", description: "...", image: "ipfs://..." }

  // 4. Also convert the image URI
  return {
    name:        metadata.name,
    description: metadata.description,
    image:       resolveIpfsUri(metadata.image),
    attributes:  metadata.attributes || [],
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

Open [http://localhost:3000](http://localhost:3000).

Make sure the contracts are deployed and `constants/network.js` has the correct addresses before starting the frontend.

> For local development: run `npx hardhat node` and `npx hardhat deploy --network localhost` from the **project root** first.