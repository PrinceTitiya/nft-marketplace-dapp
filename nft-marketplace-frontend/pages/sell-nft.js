"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWalletClient, useWatchContractEvent } from "wagmi";
import { ethers } from "ethers";

// Importing ABIs
import nftAbi from "../constants/BasicNft.json";
import marketplaceAbi from "../constants/Marketplace.json";
import { marketplaceAddress } from "../constants/network";

export default function SellNft() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Common states
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  // Listing states
  const [nftAddress, setNftAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("");

  // Cancel listing states
  const [cancelNftAddress, setCancelNftAddress] = useState("");
  const [cancelTokenId, setCancelTokenId] = useState("");
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Proceeds
  const [proceeds, setProceeds] = useState(null);

  // Update listing states
  const [updateNftAddress, setUpdateNftAddress] = useState("");
  const [updateTokenId, setUpdateTokenId] = useState("");
  const [listing, setListing] = useState(null);
  const [newPrice, setNewPrice] = useState("");

  // ✅ Toast state
  const [toast, setToast] = useState({ message: "", type: "info", visible: false });
  const toastTimerRef = useRef(null);

  const showToast = (message, type = "info", duration = 4500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, duration);
  };

  const inferTypeFromMessage = (msg) => {
    if (!msg) return "info";
    if (msg.includes("✅")) return "success";
    if (msg.includes("❌") || /error/i.test(msg)) return "error";
    if (msg.includes("⚠️") || /warn/i.test(msg)) return "info";
    return "info";
  };

  // whenever status changes, trigger toast
  useEffect(() => {
    if (status && typeof status === "string") {
      const t = inferTypeFromMessage(status);
      showToast(status, t);
    }
  }, [status]);

  // ✅ Fetch proceeds
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

  // ✅ List NFT
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

  // ✅ Cancel Listing
  const handleCancelListing = async () => {
    if (!walletClient) return;

    try {
      setStatus("Canceling listing...");
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      const listing = await marketplaceContract.getListing(
        cancelNftAddress,
        cancelTokenId
      );
      if (listing.price.toString() === "0") {
        setStatus("⚠️ This NFT is not listed");
        setShowConfirmCancel(false);
        return;
      }

      const tx = await marketplaceContract.cancelListing(
        cancelNftAddress,
        cancelTokenId
      );
      await tx.wait();

      setStatus("✅ NFT successfully canceled!");
      setCancelNftAddress("");
      setCancelTokenId("");
      setShowConfirmCancel(false);
    } catch (err) {
      console.error("Error canceling listing", err);
      setStatus("❌ Error: " + err.message);
      setShowConfirmCancel(false);
    }
  };

  // ✅ Watch for ItemCanceled event
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: "ItemCanceled",
    onLogs(logs) {
      logs.forEach((log) => {
        const { args } = log;
        if (!args) return;
        if (
          args.seller.toLowerCase() === address?.toLowerCase() &&
          args.nftAddress.toLowerCase() === cancelNftAddress.toLowerCase() &&
          args.tokenId.toString() === cancelTokenId
        ) {
          setStatus(`Listing for Token #${args.tokenId} canceled successfully`);
        }
      });
    },
  });

  // ✅ Withdraw proceeds
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

  // ✅ Check Listing for Update
  async function checkListing() {
    if (!walletClient || !updateNftAddress || updateTokenId === "") return;
    try {
      setStatus("Checking listing...");
      const provider = new ethers.BrowserProvider(walletClient);
      const contract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        provider
      );
      const listingData = await contract.getListing(
        updateNftAddress,
        updateTokenId
      );

      if (listingData.price > 0) {
        setListing({
          price: ethers.formatEther(listingData.price),
          seller: listingData.seller,
        });
        setStatus("");
      } else {
        setListing(null);
        setStatus("❌ This NFT is not listed.");
      }
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Error checking listing.");
    }
  }

  // ✅ Update Listing Price
  async function updateListing() {
    if (!walletClient || !updateNftAddress || !updateTokenId || !newPrice) return;
    try {
      setStatus("Updating listing...");
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        marketplaceAddress,
        marketplaceAbi,
        signer
      );

      const tx = await contract.updateListing(
        updateNftAddress,
        updateTokenId,
        ethers.parseEther(newPrice)
      );
      await tx.wait();

      setStatus("✅ Listing updated successfully!");
      setListing({ ...listing, price: newPrice });
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Failed to update listing.");
    }
  }

  // ✅ Prevent hydration errors
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">
      {/* Floating Toast */}
      {toast.visible && (
        <div className="fixed top-20 right-4 z-50">
          <div
            className={`max-w-sm px-4 py-3 rounded shadow-md text-black
              ${toast.type === "success" ? "bg-green-200" : toast.type === "error" ? "bg-red-200" : "bg-yellow-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm leading-tight">{toast.message}</div>
              <button
                onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
                className="ml-3 text-sm font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== LIST + CANCEL GRID ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* List NFT */}
        <div className="p-6 bg-white dark:bg-gray-900 text-white rounded-2xl shadow-md">
          <h1 className="text-2xl font-bold mb-6">List Your NFT</h1>
          <input
            type="text"
            placeholder="NFT contract address"
            value={nftAddress}
            onChange={(e) => setNftAddress(e.target.value)}
            className="w-full p-2 border text-black rounded mb-3"
          />
          <input
            type="text"
            placeholder="Token ID"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            className="w-full p-2 border text-black rounded mb-3"
          />
          <input
            type="text"
            placeholder="Price in ETH"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-2 border text-black rounded mb-3"
          />
          <button
            onClick={handleListItem}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            disabled={!isConnected}
          >
            List NFT
          </button>
        </div>

        {/* Cancel Listing */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-white">Cancel Listing</h2>
          <input
            type="text"
            placeholder="NFT contract address"
            value={cancelNftAddress}
            onChange={(e) => setCancelNftAddress(e.target.value)}
            className="w-full p-2 border rounded mb-3"
          />
          <input
            type="text"
            placeholder="Token ID"
            value={cancelTokenId}
            onChange={(e) => setCancelTokenId(e.target.value)}
            className="w-full p-2 border rounded mb-3"
          />
          <button
            onClick={() => {
              if (!cancelNftAddress || !cancelTokenId) {
                setStatus("⚠️ Enter NFT address and Token ID before canceling");
                return;
              }
              setShowConfirmCancel(true);
            }}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg"
            disabled={!isConnected}
          >
            Cancel Listing
          </button>
        </div>
      </div>

      {/* ===================== UPDATE LISTING ===================== */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Update Listing
        </h2>
        <input
          type="text"
          placeholder="NFT contract address"
          value={updateNftAddress}
          onChange={(e) => setUpdateNftAddress(e.target.value)}
          className="w-full p-2 border rounded mb-3"
        />
        <input
          type="text"
          placeholder="Token ID"
          value={updateTokenId}
          onChange={(e) => setUpdateTokenId(e.target.value)}
          className="w-full p-2 border rounded mb-3"
        />
        <button
          onClick={checkListing}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg mb-4"
        >
          Check Listing
        </button>

        {listing && (
          <div className="space-y-3 text-white">
            <p>
              ✅ Listed by:{" "}
              <span className="font-mono text-sm">{listing.seller}</span>
            </p>
            <p>
              Current Price:{" "}
              <span className="font-semibold">{listing.price} ETH</span>
            </p>
            <input
              type="text"
              placeholder="New Price (ETH)"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-full p-2 border text-black rounded mb-3"
            />
            <button
              onClick={updateListing}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg"
            >
              Update Price
            </button>
          </div>
        )}
      </div>

      {/* ===================== CONFIRMATION MODAL ===================== */}
      {showConfirmCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm text-center">
            <p className="text-lg font-semibold mb-4">
              Are you sure you want to cancel your listed item?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleCancelListing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PROCEEDS SECTION ===================== */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold mb-4 text-gray-90 dark:text-white">
          Your Proceeds
        </h2>
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
            disabled={!proceeds || parseFloat(proceeds) === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !proceeds || parseFloat(proceeds) === 0
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
