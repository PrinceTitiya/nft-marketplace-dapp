"use client"

import { useQuery } from "@tanstack/react-query"
import { gql, request } from "graphql-request"
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from "wagmi"
import marketplaceAbi from "../constants/Marketplace.json"
import networkMapping from "../constants/networkMapping.json"
import { useChainId } from "wagmi"
import { ethers } from "ethers"
import { useEffect, useState } from "react"

// ----------------- Style -------------------- //
const styles = {
    pageWrapper: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #0d1b3e 70%, #0c0c1e 100%)",
        position: "relative",
        overflow: "hidden",
        padding: "40px 20px",
    },
    orb1: {
        position: "fixed",
        top: "-120px",
        left: "-120px",
        width: "500px",
        height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%)",
        filter: "blur(60px)",
    },
    orb2: {
        position: "fixed",
        bottom: "-100px",
        right: "-100px",
        width: "460px",
        height: "460px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)",
        filter: "blur(70px)",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "24px",
        position: "relative",
        zIndex: 1,
    },
    card: {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(18px)",
        borderRadius: "18px",
        padding: "16px",
        transition: "0.25s",
    },
    img: {
        width: "100%",
        height: "180px",
        objectFit: "cover",
        borderRadius: "12px",
        marginBottom: "12px",
    },
    placeholder: {
        width: "100%",
        height: "180px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        marginBottom: "12px",
    },
    name: {
        color: "#e2e8f0",
        fontWeight: "700",
    },
    text: {
        color: "#94a3b8",
        fontSize: "0.8rem",
    },
    price: {
        color: "#c7d2fe",
        fontWeight: "600",
        marginTop: "4px",
    },
    btn: {
        marginTop: "10px",
        width: "100%",
        padding: "10px",
        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
        border: "none",
        borderRadius: "10px",
        color: "#fff",
        fontWeight: "600",
        cursor: "pointer",
    },
    btnDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    badge: {
        position: "absolute",
        top: "8px",
        right: "8px",
        background: "#7c3aed",
        color: "#fff",
        fontSize: "0.6rem",
        padding: "4px 8px",
        borderRadius: "999px",
    },
}

// Creating a query for active listing
const GET_ACTIVE_ITEMS = gql`
    query GetActiveItems($first: Int!, $skip: Int!) {
        activeItems(first: $first, skip: $skip, orderBy: tokenId) {
            id
            seller
            nftAddress
            tokenId
            price
        }
    }
`

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/102524/nft-marketplace/version/latest"

const metadataCache = {}

function useListings(page = 0) {
    return useQuery({
        queryKey: ["activeItems", page],
        queryFn: async () => {
            const data = await request(SUBGRAPH_URL, GET_ACTIVE_ITEMS, {
                first: 20,
                skip: page * 20,
            })
            return data.activeItems
        },
    })
}

const erc721Abi = [
    {
        name: "tokenURI",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ type: "string" }],
    },
]

async function fetchNftMetadata(publicClient, nftAddr, tokenId) {
    try {
        const tokenUri = await publicClient.readContract({
            address: nftAddr,
            abi: erc721Abi,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
        })

        const url = tokenUri.startsWith("ipfs://")
            ? tokenUri.replace("ipfs://", "https://ipfs.io/ipfs/")
            : tokenUri

        const res = await fetch(url)
        const metadata = await res.json()

        return {
            name: metadata.name,
            image: metadata.image?.startsWith("ipfs://")
                ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
                : metadata.image,
        }
    } catch (err) {
        console.error(`Metadata fetch failed for ${nftAddr}-${tokenId}`, err)
        return {
            name: `#${tokenId}`,
            image: null,
        }
    }
}

export default function GraphMarketplace() {
    const [page, setPage] = useState(0)
    const { data: listings, status, refetch } = useListings(page)
    const [metadata, setMetadata] = useState({})

    const { switchChain } = useSwitchChain()
    const { address, isConnected } = useAccount()
    const { writeContract } = useWriteContract()
    const chainId = useChainId()
    const publicClient = usePublicClient()

    const marketplaceAddress = networkMapping[chainId]?.NftMarketplace?.[0]
    const SEPOLIA_CHAIN_ID = 11155111

    // fetch metadata
    useEffect(() => {
        if (!listings || !publicClient) return

        async function loadMetadata() {
            const metaMap = {}

            await Promise.all(
                listings.map(async (item) => {
                    const key = `${item.nftAddress}-${item.tokenId}`

                    // check cache first
                    if (metadataCache[key]) {
                        metaMap[key] = metadataCache[key]
                        return
                    }

                    // Fetch if not cached
                    const meta = await fetchNftMetadata(
                        publicClient,
                        item.nftAddress,
                        item.tokenId
                    )

                    if (meta) {
                        metadataCache[key] = meta
                        metaMap[key] = meta
                    }
                })
            )
            setMetadata(metaMap)
        }
        loadMetadata()
    }, [listings, publicClient])

    if (isConnected && chainId !== SEPOLIA_CHAIN_ID) {
        return <div>Wrong Network UI...</div>
    }

    const handleBuy = async (listing) => {
        await writeContract({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "buyItem",
            args: [listing.nftAddress, listing.tokenId],
            value: listing.price,
        })
        refetch() // refreshes listings after buying item
    }

    if (status === "pending") return <p>Loading....</p>
    if (status === "error") return <p>Error Loading data</p>

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.orb1} />
            <div style={styles.orb2} />

            {listings.length === 0 ? (
                <p style={{ color: "#94a3b8", textAlign: "center" }}>No NFTs listed yet</p>
            ) : (
                <div style={styles.grid}>
                    {listings.map((listing, i) => {
                        const meta = metadata[`${listing.nftAddress}-${listing.tokenId}`]

                        return (
                            <div key={i} style={styles.card}>
                                <div style={{ position: "relative" }}>
                                    {meta?.image ? (
                                        <img src={meta.image} style={styles.img} />
                                    ) : (
                                        <div style={styles.placeholder}>Loading...</div>
                                    )}

                                    {address &&
                                        listing.seller?.toLowerCase() ===
                                            address.toLowerCase() && (
                                            <span style={styles.badge}>OWNED</span>
                                        )}
                                </div>

                                <p style={styles.name}>{meta?.name || `#${listing.tokenId}`}</p>

                                <p style={styles.text}>{listing.seller.slice(0, 10)}...</p>

                                <p style={styles.price}>{ethers.formatEther(listing.price)} ETH</p>

                                <button
                                    style={{
                                        ...styles.btn,
                                        ...(!isConnected ? styles.btnDisabled : {}),
                                    }}
                                    onClick={() => handleBuy(listing)}
                                    disabled={!isConnected}
                                >
                                    Buy Now
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
