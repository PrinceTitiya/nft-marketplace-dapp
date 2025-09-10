export const marketplaceAddress =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Hardhat local deploy

export const marketplaceAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: true, internalType: "address", name: "nftAddress", type: "address" },
      { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "price", type: "uint256" },
    ],
    name: "ItemListed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: true, internalType: "address", name: "nftAddress", type: "address" },
      { indexed: false, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "price", type: "uint256" },
    ],
    name: "ItemBought",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: true, internalType: "address", name: "nftAddress", type: "address" },
      { indexed: false, internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "ItemCanceled",
    type: "event",
  },
];
