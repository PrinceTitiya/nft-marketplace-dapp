import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";

// Importing ABIs
import nftAbi from "../constants/BasicNft.json";
import marketplaceAbi from "../constants/Marketplace.json";
import { marketplaceAddress } from "../constants/network";

export default function SellNft() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [nftAddress, setNftAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("");
  const [proceeds, setProceeds] = useState(null);

  const [mounted, setMounted] = useState(false);

  // ✅ Function definitions must come before useEffect
  const fetchProceeds = async () => {
    if (!walletClient || !address) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      const userProceeds = await marketplaceContract.getProceeds(address);
      setProceeds(ethers.formatEther(userProceeds));
    } catch (err) {
      console.error("Error fetching proceeds:", err);
    }
  };

  const handleListItem = async () => {
    if (!walletClient) return;

    try {
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      // ✅ Check if already listed
      const listing = await marketplaceContract.getListing(nftAddress, tokenId);
      if (listing.price > 0) {
        setStatus("⚠️ This NFT is already listed!");
        return;
      }

      setStatus("Approving NFT...");
      const nftContract = new ethers.Contract(nftAddress, nftAbi, signer);
      const approveTx = await nftContract.approve(marketplaceAddress, tokenId);
      await approveTx.wait();

      setStatus("Listing NFT...");
      const priceInWei = ethers.parseEther(price);
      const tx = await marketplaceContract.listItem(
        nftAddress,
        tokenId,
        priceInWei
      );
      await tx.wait();

      setStatus("✅ NFT Listed Successfully!");
      fetchProceeds();
    } catch (err) {
      console.error(err);
      setStatus("❌ Error: " + err.message);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      setStatus("Withdrawing Proceeds...");
      const tx = await marketplaceContract.withdrawProceeds();
      await tx.wait();

      setStatus("✅ Withdrawal Successful!");
      fetchProceeds();
    } catch (err) {
      console.error("Error withdrawing proceeds:", err);
      setStatus("❌ Error: " + err.message);
    }
  };

  // ✅ Hooks now come after function definitions
  useEffect(() => setMounted(true), []);

  // useEffect(() => {
  //   fetchProceeds();
  // }, [walletClient, address]);

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">List Your NFT</h1>

      <input
        type="text"
        placeholder="NFT contract address"
        value={nftAddress}
        onChange={(e) => setNftAddress(e.target.value)}
        className="w-full p-2 border rounded mb-3"
      />

      <input
        type="text"
        placeholder="Token ID"
        value={tokenId}
        onChange={(e) => setTokenId(e.target.value)}
        className="w-full p-2 border rounded mb-3"
      />

      <input
        type="text"
        placeholder="Price in ETH"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full p-2 border rounded mb-3"
      />

      <button
        onClick={handleListItem}
        className="px-4 py-2 bg-black text-white rounded-lg text-center font-medium transition-all duration-200 dark:hover:text-indigo-400"
        disabled={!isConnected}
      >
        List NFT
      </button>

      {status && <p className="mt-4">{status}</p>}

      {/* Proceeds Section */}
<div className="mt-10 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-md">
  <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
    💰 Your Proceeds
  </h2>

   {/* Show balance only after clicking the button */}
   {proceeds !== null && (
    <p className="mb-4 text-gray-800 dark:text-gray-200">
      Balance: {proceeds} ETH
    </p>
  )}

  <div className="flex items-center space-x-4">
    <button
      onClick={fetchProceeds}
      className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
    >
      Check Balance
    </button>

    <button
      onClick={handleWithdraw}
      disabled={parseFloat(proceeds) === 0}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        parseFloat(proceeds) === 0
          ? "bg-gray-400 cursor-not-allowed text-white"
          : "bg-indigo-600 hover:bg-indigo-700 text-white"
      }`}
    >
      Withdraw
    </button>
  </div>
</div>
</div>
);
}
