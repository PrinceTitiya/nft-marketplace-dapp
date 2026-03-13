import "@/styles/globals.css";
import Head from "next/head";
import "@rainbow-me/rainbowkit/styles.css";

//--- (wagmi + rainbow-kit) imports ----
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

//Header file import
import Header from "../components/Header";

// --- React Query Client ---
const queryClient = new QueryClient();

// --- Custom Hardhat localhost chain (chainId 31337) ---
const hardhat = {
  id: 31337,
  name: "Hardhat Localhost",
  network: "hardhat",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
};

const config = getDefaultConfig({
  appName: "NFT Marketplace",
  projectId: "2ed874349d32ee3feede6626811a6784", // Demo project ID
  chains: [hardhat, sepolia], // support both Hardhat + Sepolia
});

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Head>
            <title>NFT Marketplace</title>
            <meta
              name="description"
              content="NFT Marketplace built with Next.js"
            />
            <link rel="icon" href="/favicon.ico" />
          </Head>

          <Header />

          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
