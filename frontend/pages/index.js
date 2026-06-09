"use client"

import { useQuery } from "@tanstack/react-query"
import { gql, request } from "graphql-request"
import { useAccount, useWriteContract, usePublicClient } from "wagmi"
import marketplaceAbi from "../constants/Marketplace.json"
import networkMapping from "../constants/networkMapping.json"
import { useChainId } from "wagmi"
import { ethers } from "ethers"
import { useEffect, useState } from "react"

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
    } catch {
        return { name: `#${tokenId}`, image: null }
    }
}

export default function GraphMarketplace() {
    const [page] = useState(0)
    const { data: listings, status, refetch } = useListings(page)
    const [metadata, setMetadata] = useState({})

    const { address, isConnected } = useAccount()
    const { writeContract } = useWriteContract()
    const chainId = useChainId()
    const publicClient = usePublicClient()

    const marketplaceAddress = networkMapping[chainId]?.NftMarketplace?.[0]
    const SEPOLIA_CHAIN_ID = 11155111

    useEffect(() => {
        if (!listings || !publicClient) return

        async function loadMetadata() {
            const metaMap = {}
            await Promise.all(
                listings.map(async (item) => {
                    const key = `${item.nftAddress}-${item.tokenId}`
                    if (metadataCache[key]) {
                        metaMap[key] = metadataCache[key]
                        return
                    }
                    const meta = await fetchNftMetadata(publicClient, item.nftAddress, item.tokenId)
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

    const handleBuy = async (listing) => {
        await writeContract({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "buyItem",
            args: [listing.nftAddress, listing.tokenId],
            value: listing.price,
        })
        refetch()
    }

    if (isConnected && chainId !== SEPOLIA_CHAIN_ID) {
        return (
            <div style={S.centerWrap}>
                <p style={S.errCode}>ERR // WRONG_NETWORK</p>
                <p style={S.errMsg}>Connect to Sepolia testnet to browse listings.</p>
            </div>
        )
    }

    if (status === "pending") {
        return (
            <div style={S.centerWrap}>
                <span className="mono" style={S.loadText}>
                    FETCHING LISTINGS
                    <span style={{ color: "#00e5ff" }}>...</span>
                </span>
            </div>
        )
    }

    if (status === "error") {
        return (
            <div style={S.centerWrap}>
                <p style={S.errCode}>ERR // SUBGRAPH_FETCH_FAILED</p>
                <p style={S.errMsg}>Unable to load listings. Check your connection.</p>
            </div>
        )
    }

    return (
        <div style={S.page}>
            {listings.length === 0 ? (
                <div style={S.centerWrap}>
                    <div style={S.emptyIcon}>○</div>
                    <p className="mono" style={S.emptyText}>
                        NO ACTIVE LISTINGS
                    </p>
                </div>
            ) : (
                <div style={S.grid}>
                    {listings.map((listing, i) => {
                        const meta = metadata[`${listing.nftAddress}-${listing.tokenId}`]
                        const isOwned =
                            address &&
                            listing.seller?.toLowerCase() === address.toLowerCase()

                        return (
                            <div key={i} className="nft-card">
                                {/* Image */}
                                <div style={S.imgWrap}>
                                    {meta?.image ? (
                                        <img
                                            src={meta.image}
                                            alt={meta?.name}
                                            style={S.img}
                                        />
                                    ) : (
                                        <div className="skeleton" style={S.imgSkeleton} />
                                    )}
                                    {isOwned && (
                                        <span className="mono" style={S.badge}>
                                            OWNED
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <p style={S.nftName}>{meta?.name ?? `Token #${listing.tokenId}`}</p>
                                <p className="mono" style={S.seller}>
                                    {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                                </p>
                                <p className="mono" style={S.price}>
                                    {ethers.formatEther(listing.price)} ETH
                                </p>

                                <button
                                    className="btn btn-cyan btn-full"
                                    style={{ marginTop: "12px" }}
                                    onClick={() => handleBuy(listing)}
                                    disabled={!isConnected}
                                >
                                    {isConnected ? "BUY ITEM" : "CONNECT WALLET"}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const S = {
    page: {
        position: "relative",
        zIndex: 1,
        padding: "32px 24px",
        minHeight: "calc(100vh - 64px)",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        gap: "20px",
    },
    imgWrap: {
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        overflow: "hidden",
        borderRadius: "8px",
        marginBottom: "14px",
        background: "rgba(168, 85, 247, 0.06)",
    },
    img: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
    },
    imgSkeleton: {
        width: "100%",
        height: "100%",
    },
    badge: {
        position: "absolute",
        top: "8px",
        right: "8px",
        background: "rgba(5, 5, 10, 0.88)",
        border: "1px solid rgba(168, 85, 247, 0.55)",
        color: "#d8b4fe",
        fontSize: "0.58rem",
        letterSpacing: "0.14em",
        padding: "3px 8px",
        borderRadius: "4px",
    },
    nftName: {
        fontSize: "1rem",
        fontWeight: "700",
        color: "#ffffff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        marginBottom: "4px",
    },
    seller: {
        fontSize: "0.75rem",
        color: "#9a9a9a",
        marginBottom: "6px",
    },
    price: {
        fontSize: "0.95rem",
        fontWeight: "700",
        letterSpacing: "0.02em",
        background: "linear-gradient(90deg, #a855f7, #d8b4fe)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    centerWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        gap: "10px",
        position: "relative",
        zIndex: 1,
    },
    loadText: {
        fontSize: "0.72rem",
        letterSpacing: "0.16em",
        color: "rgba(168, 85, 247, 0.45)",
    },
    emptyIcon: {
        fontSize: "1.8rem",
        color: "rgba(168, 85, 247, 0.35)",
        fontWeight: "100",
        lineHeight: 1,
    },
    emptyText: {
        fontSize: "0.68rem",
        letterSpacing: "0.16em",
        color: "rgba(168, 85, 247, 0.45)",
    },
    errCode: {
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: "0.68rem",
        letterSpacing: "0.15em",
        color: "#f85149",
    },
    errMsg: {
        fontSize: "0.82rem",
        color: "#9a9a9a",
        maxWidth: "360px",
        textAlign: "center",
    },
}
