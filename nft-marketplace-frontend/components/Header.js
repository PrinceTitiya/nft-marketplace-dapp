// components/Header.js
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

export default function Header() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (!isConnected) return;

    // Allow Sepolia (11155111) and Hardhat (31337)
    // If wallet is on another chain, switch to Sepolia by default
    if (chainId !== 31337 && chainId !== 11155111) {
      console.log("Unsupported chain, switching to Sepolia...");
      switchChain({ chainId: 11155111 }).catch((err) => {
        console.warn("Switch chain failed:", err.message);
      });
    }
  }, [isConnected, chainId, switchChain]);

  return (
    <nav className="w-full bg-white dark:bg-gray-900 shadow-md p-5 flex flex-col md:flex-row justify-between items-center md:items-center gap-4 md:gap-0">
      {/* Logo / Home */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
        NFT Marketplace
      </h1>

      {/* Navigation Links & Connect Button */}
      <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
        <Link
          href="/"
          className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
        >
          Home
        </Link>
        <Link
          href="/sell-nft"
          className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
        >
          Sell NFT
        </Link>
        {/* RainbowKit Connect Button */}
        <ConnectButton
          showBalance={false}
          accountStatus="address"
          chainStatus="icon"
        />
      </div>
    </nav>
  );
}
