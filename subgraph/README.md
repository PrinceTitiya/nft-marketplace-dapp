# NFT Marketplace Subgraph

This folder contains the **GraphQL Subgraph** for the NFT Marketplace, built using [The Graph Protocol](https://thegraph.com/). 

## ⚠️ Status: Work in Progress
> **Note:** This subgraph is currently deployed and functional in isolation, but **it is not yet fully integrated into the main frontend application**. The frontend is still relying on direct smart contract reads or local event listening for its primary data fetching.

---

## 🌟 What is a Subgraph and its Usefulness?

Reading data directly from a blockchain (like Ethereum or Sepolia) using smart contracts can be slow, inefficient, and highly restricted. For example, if you want to answer questions like:
- *"Who are all the sellers currently listing an NFT?"*
- *"Show me all NFTs that have been bought in the last 2 days."*

Smart contracts cannot easily loop through all past events without burning massive amounts of gas or taking forever on the frontend. 

**The Graph** solves this by acting as an indexing layer. It listens to the events emitted by our `NftMarketplace` smart contract (like `ItemListed`, `ItemBought`, and `ItemCanceled`), organizes them, and stores them in a database. We can then query this database instantly using **GraphQL**, giving us a faster, more flexible, and highly performant backend for our decentralized application.

---

## 🔄 Flow of the Subgraph

1. **Smart Contract Emits Events:** A user interacts with the `NftMarketplace` contract on Sepolia (e.g., lists an NFT). The contract emits an `ItemListed` event.
2. **Graph Node Listens:** The decentralized Graph network (or a local Graph Node) is actively listening to the Sepolia blockchain for specifically these events.
3. **Event Handlers Trigger:** When an event is caught, it triggers the mapping functions written in `src/nft-marketplace.ts`.
4. **Data Entity Creation/Updating:** 
   - The mapping explicitly assigns exactly what happened to entities defined in `schema.graphql`.
   - For example: It creates a permanent history log (`ItemListed` entity) and dynamically creates an `ActiveItem` entity. If an item is bought or canceled later, it removes the NFT from the `ActiveItem` database.
5. **Data Querying:** The frontend can send a simple GraphQL query to the Subgraph URL to instantly fetch `activeItems`.

---

## 🛠️ Useful Instructions

### Prerequisites
Make sure you have Node and Yarn (or NPM) installed, and the Graph CLI:
```bash
npm install -g @graphprotocol/graph-cli
# or 
yarn global add @graphprotocol/graph-cli
```

### 1. Generating Types & Code
Whenever you update your `schema.graphql` or the smart contract ABIs inside `/abis`, you MUST generate the new assemblyscript types so your `src/nft-marketplace.ts` mappings can use them.
```bash
yarn graph codegen
```

### 2. Building the Subgraph
To compile the mappings and verify there are no errors in your subgraph:
```bash
yarn graph build
```

### 3. Deploying to the Graph Studio
To deploy this subgraph live so you can query it from anywhere:

1. Go to [The Graph Studio](https://thegraph.com/studio/) and create a subgraph.
2. Authenticate your CLI using your unique deploy key:
   ```bash
   graph auth --studio <DEPLOY_KEY>
   ```
3. Deploy the subgraph:
   ```bash
   graph deploy --studio <YOUR_SUBGRAPH_NAME>
   ```

### 4. Querying the Subgraph
Once deployed, you will receive a Query URL. You can test GraphQL queries directly in the browser via your Graph Studio Dashboard. 

**Example Query:**
```graphql
{
  activeItems(first: 5) {
    id
    buyer
    seller
    nftAddress
    tokenId
    price
  }
}
```
