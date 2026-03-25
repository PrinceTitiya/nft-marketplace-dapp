"use client"
import { useState, useEffect } from "react"
import {
    usePublicClient,
    useWatchContractEvent,
    useWriteContract,
    useAccount,
    useChainId,
} from "wagmi"
import marketplaceAbi from "../constants/Marketplace.json"
import networkMapping from "../constants/networkMapping.json"
import { ethers } from "ethers"

const erc721Abi = [
    {
        name: "tokenURI",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ type: "string" }],
    },
]

/* ================= STYLES ================= */
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

/* ================= HELPERS ================= */
function resolveIpfsUri(uri) {
    if (!uri) return ""
    return uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://ipfs.io/ipfs/") : uri
}

async function fetchNftMetadata(publicClient, nftAddr, tokenId) {
    try {
        const tokenUri = await publicClient.readContract({
            address: nftAddr,
            abi: erc721Abi,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
        })

        const res = await fetch(resolveIpfsUri(tokenUri))
        const metadata = await res.json()

        return {
            name: metadata.name,
            image: resolveIpfsUri(metadata.image),
        }
    } catch {
        return null
    }
}

/* ================= COMPONENT ================= */
export default function Home() {
    const [listings, setListings] = useState([])
    const [nftMetadata, setNftMetadata] = useState({})

    const publicClient = usePublicClient()
    const { address } = useAccount()
    const { writeContract } = useWriteContract()
    const chainId = useChainId()

    const marketplaceAddress = networkMapping[chainId]?.NftMarketplace?.[0] ?? null

    /* FETCH LISTINGS */
    useEffect(() => {
        if (!marketplaceAddress || !publicClient) return

        async function fetchListings() {
            const logs = await publicClient.getLogs({
                address: marketplaceAddress,

                event: {
                    type: "event",
                    name: "ItemListed",
                    inputs: [
                        { type: "address", name: "seller", indexed: true },
                        { type: "address", name: "nftAddress", indexed: true },
                        { type: "uint256", name: "tokenId", indexed: true },
                        { type: "uint256", name: "price" },
                    ],
                },
                fromBlock: 10499687n, // 10484314
                toBlock: 10499689n,
            })

            const activeListings = []

            for (const log of logs) {
                const { seller, nftAddress, tokenId, price } = log.args

                const listing = await publicClient.readContract({
                    address: marketplaceAddress,
                    abi: marketplaceAbi,
                    functionName: "getListing",
                    args: [nftAddress, tokenId],
                })

                if (listing.seller !== ethers.ZeroAddress) {
                    activeListings.push({
                        seller,
                        nftAddress,
                        tokenId: tokenId.toString(),
                        price: price.toString(),
                    })
                }
            }
            setListings(activeListings)

            // fetch metadata
            const metaMap = {}
            for (const item of activeListings) {
                const meta = await fetchNftMetadata(publicClient, item.nftAddress, item.tokenId)
                if (meta) metaMap[`${item.nftAddress}-${item.tokenId}`] = meta
            }
            setNftMetadata(metaMap)
        }
        fetchListings()
    }, [marketplaceAddress, publicClient, chainId])

    /* EVENTS */
    useWatchContractEvent({
        address: marketplaceAddress,
        chainId,
        abi: marketplaceAbi,
        eventName: "ItemListed",
        enabled: !!marketplaceAddress,
        onLogs(logs) {
            logs.forEach((log) => {
                if (!log.args) return

                const newListing = {
                    seller: log.args.seller,
                    nftAddress: log.args.nftAddress,
                    tokenId: log.args.tokenId.toString(),
                    price: log.args.price.toString(),
                }

                setListings((prev) => {
                    const exists = prev.some(
                        (l) =>
                            l.nftAddress === newListing.nftAddress &&
                            l.tokenId === newListing.tokenId
                    )

                    if (exists) return prev
                    return [...prev, newListing]
                })
            })
        },
    })

    useWatchContractEvent({
        address: marketplaceAddress,
        chainId,
        abi: marketplaceAbi,
        eventName: "ItemBought",
        enabled: !!marketplaceAddress,
        onLogs(logs) {
            logs.forEach((log) => {
                if (!log.args) return

                const boughtTokenId = log.args.tokenId.toString()
                const nftAddr = log.args.nftAddress

                setListings((prev) =>
                    prev.filter((l) => !(l.nftAddress === nftAddr && l.tokenId === boughtTokenId))
                )
            })
        },
    })

    const handleBuy = async (listing) => {
        await writeContract({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "buyItem",
            args: [listing.nftAddress, listing.tokenId],
            value: listing.price,
        })
    }

    if (!marketplaceAddress) {
        return <p style={{ color: "#fff" }}>Unsupported Network</p>
    }

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.orb1} />
            <div style={styles.orb2} />

            {listings.length === 0 ? (
                <p style={{ color: "#94a3b8", textAlign: "center" }}>No NFTs listed yet</p>
            ) : (
                <div style={styles.grid}>
                    {listings.map((listing, i) => {
                        const meta = nftMetadata[`${listing.nftAddress}-${listing.tokenId}`]

                        return (
                            <div key={i} style={styles.card}>
                                <div style={{ position: "relative" }}>
                                    {meta?.image ? (
                                        <img src={meta.image} style={styles.img} />
                                    ) : (
                                        <div style={styles.placeholder}>Loading...</div>
                                    )}

                                    {address &&
                                        listing.seller.toLowerCase() === address.toLowerCase() && (
                                            <span style={styles.badge}>OWNED</span>
                                        )}
                                </div>

                                <p style={styles.name}>{meta?.name || `#${listing.tokenId}`}</p>

                                <p style={styles.text}>{listing.seller.slice(0, 10)}...</p>

                                <p style={styles.price}>{ethers.formatEther(listing.price)} ETH</p>

                                <button style={styles.btn} onClick={() => handleBuy(listing)}>
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
