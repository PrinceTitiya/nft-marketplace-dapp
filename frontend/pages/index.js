import { useState, useEffect } from "react";
import { usePublicClient, useWatchContractEvent, useWriteContract, useAccount } from "wagmi";
import marketplaceAbi from "../constants/Marketplace.json";
import { marketplaceAddress, nftAddress } from "../constants/network";
import { ethers } from "ethers"; 
import nftAbi from "../constants/BasicNft.json"

//  Convert ipfs:// URIs to HTTP gateway URLs
// Browsers can't resolve ipfs:// natively, so we proxy through a public gateway
function resolveIpfsUri(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri; // already an HTTP URL
}

//  Fetch NFT metadata (name + image) from the tokenURI
async function fetchNftMetadata(publicClient, nftAddr, tokenId) {
  try {
    // Step 1: Call tokenURI(tokenId) on the NFT contract
    const tokenUri = await publicClient.readContract({
      address: nftAddr,
      abi: nftAbi,
      functionName: "tokenURI",
      args: [BigInt(tokenId)],
    });

    // Step 2: Convert ipfs:// to https:// so we can fetch it
    const httpUrl = resolveIpfsUri(tokenUri);

    // Step 3: Fetch the JSON metadata from IPFS
    const response = await fetch(httpUrl);
    const metadata = await response.json();

    // Step 4: Resolve the image URI inside the metadata too
    return {
      name: metadata.name || `NFT #${tokenId}`,
      description: metadata.description || "",
      image: resolveIpfsUri(metadata.image),
      attributes: metadata.attributes || [],
    };
  } catch (err) {
    console.error(`Failed to fetch metadata for token ${tokenId}:`, err);
    return null;
  }
}

export default function Home() {
  const [listings, setListings] = useState([]);
  const [nftMetadata, setNftMetadata] = useState({}); // tokenId -> metadata
  const publicClient = usePublicClient();
  const { address: connectedAddress } = useAccount();

  //  Fetches past listings
  useEffect(() => {
    async function fetchListings() {
      try{
        const totalMinted = await publicClient.readContract({
          address: nftAddress,
          abi:nftAbi,
          functionName: "getTokenCounter",
        });

        const results = [];

        for (let tokenId = 0; tokenId<Number(totalMinted); tokenId++){
          const listing = await publicClient.readContract({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "getListing",
            args: [nftAddress,tokenId],
          });

          if (
            listing.seller !==
            "0x0000000000000000000000000000000000000000"
          ) {
            results.push({
              seller: listing.seller,
              nftAddress: nftAddress,
              tokenId: tokenId.toString(),
              price: listing.price.toString(),
            });
          }
        }

        setListings(results);

        // Fetch metadata for each listed NFT
        const metadataMap = {};
        for (const item of results) {
          const meta = await fetchNftMetadata(publicClient, item.nftAddress, item.tokenId);
          if (meta) {
            metadataMap[item.tokenId] = meta;
          }
        }
        setNftMetadata(metadataMap);

      } catch (err) {
        console.error("Fetch listings failed:", err);
      }
    }

    fetchListings();
  }, []);

  //  Watch new listings
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: "ItemListed",

    onLogs(logs) {
      logs.forEach(async (log) => {
        const { args } = log;
        if (!args) return;

        const newListing = {
          seller: args.seller,
          nftAddress: args.nftAddress,
          tokenId: args.tokenId.toString(),
          price: args.price.toString(),
        };

        setListings((prev) => {
          const exists = prev.some(
            (l) =>
              l.nftAddress === newListing.nftAddress &&
              l.tokenId === newListing.tokenId
          );
          return exists ? prev : [...prev, newListing];
        });

        // Also fetch metadata for the newly listed NFT
        const meta = await fetchNftMetadata(publicClient, newListing.nftAddress, newListing.tokenId);
        if (meta) {
          setNftMetadata((prev) => ({ ...prev, [newListing.tokenId]: meta }));
        }
      });
    }
  });

  //Watch bought items (remove item when sold from homePage)
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: "ItemBought",
    onLogs(logs){
      logs.forEach((log) => {
        const { args } = log;
        if (!args) return;

        const boughtTokenId = args.tokenId.toNumber()
        const nftAddress = args.nftAddress;

        setListings((prev) => 
        prev.filter(
          (l) => 
            !(l.nftAddress === nftAddress && l.tokenId === boughtTokenId)
        ))

      })
    }
  })

  const { writeContract} = useWriteContract();

  const handleBuy = async(listing) => {
    try{
      await writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyItem",
        args: [listing.nftAddress, listing.tokenId],
        value: listing.price, //Send ETH along
      });
    }
    catch(err){
      console.error("Buy failed",err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      {listings.length === 0 ? (
        <p className="text-center text-gray-500">No NFTs listed yet</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {listings.map((listing, i) => {
            const meta = nftMetadata[listing.tokenId];
            return (
              <div
                key={i}
                className="bg-white shadow-lg rounded-2xl p-4 hover:shadow-xl transition"
              >
                {/* NFT Image from IPFS metadata — wrapped for badge overlay */}
                <div style={{ position: "relative" }}>
                  {meta?.image ? (
                    <img
                      src={meta.image}
                      alt={meta.name || `NFT #${listing.tokenId}`}
                      className="w-full h-48 object-cover rounded-xl mb-4"
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  {/* Fallback placeholder (shown while loading or on error) */}
                  <div
                    className="w-full h-48 bg-gray-200 rounded-xl mb-4 flex items-center justify-center text-gray-400"
                    style={{ display: meta?.image ? "none" : "flex" }}
                  >
                    {meta ? "Image failed to load" : "Loading..."}
                  </div>

                  {/* ✅ "Owned by you" badge — shown when connected wallet == seller */}
                  {connectedAddress &&
                    listing.seller.toLowerCase() === connectedAddress.toLowerCase() && (
                      <span
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          backgroundColor: "#7c3aed",
                          color: "#fff",
                          fontSize: "0.65rem",
                          fontWeight: "700",
                          letterSpacing: "0.05em",
                          padding: "3px 8px",
                          borderRadius: "9999px",
                          textTransform: "uppercase",
                          boxShadow: "0 2px 6px rgba(124,58,237,0.5)",
                          pointerEvents: "none",
                          zIndex: 10,
                        }}
                      >
                        # Owned by you
                      </span>
                    )}
                </div>

                {/*  NFT Name from metadata */}
                {meta?.name && (
                  <p className="text-lg font-bold text-gray-900 mb-1">{meta.name}</p>
                )}

                <p className="text-sm text-gray-500 truncate font-semibold">
                  Seller: {listing.seller}
                </p>
                <p className="text-sm text-gray-700 font-semibold">
                  Token ID:{" "}
                  <span>{listing.tokenId}</span>
                </p>
                <p className="text-sm text-gray-700 font-semibold">
                  Price:{" "}
                  <span className="font-semibold">
                    {ethers.formatEther(listing.price)} ETH
                    </span>
                </p>

                <button
                onClick={()=>handleBuy(listing)}
                className="mt-3 px-4 py-2 bg-black text-white rounded-lg text-center font-medium transition-all duration-200 hover:bg-gray-800 hover:scale-105">
                  Buy Now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
