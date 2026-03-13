import { useState, useEffect } from "react";
import { usePublicClient, useWatchContractEvent, useWriteContract } from "wagmi";
import marketplaceAbi from "../constants/Marketplace.json";
import { marketplaceAddress, nftAddress } from "../constants/network";
import { ethers } from "ethers"; 
import nftAbi from "../constants/BasicNft.json"


export default function Home() {
  const [listings, setListings] = useState([]);
  const publicClient = usePublicClient();
  // ✅ Fetch past listings
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
      } catch (err) {
        console.error("Fetch listings failed:", err);
      }
    }

    fetchListings();
  }, []);

  // ✅ Watch new listings
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: "ItemListed",

    onLogs(logs) {
      logs.forEach((log) => {
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

        const boughtTokenIdd = args.tokenId.toString()
        const nftAddress = args.nftAddress;

        setListings((prev) => 
        prev.filter(
          (l) => 
            !(l.nftAddress === nftAddress && l.tokenId === boughtTokenIdd)
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
          {listings.map((listing, i) => (
            <div
              key={i}
              className="bg-white shadow-lg rounded-2xl p-4 hover:shadow-xl transition"
            >
              {/* Placeholder NFT image */}
              <div className="w-full h-40 bg-gray-200 rounded-xl mb-4 flex items-center justify-center text-gray-400">
                NFT #{listing.tokenId}
              </div>

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
              className="px-4 py-2 bg-black text-white rounded-lg text-center font-medium transition-all duration-200 hover:bg-gray-800 hover:scale-105">
                Buy Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
