"use client"

import { useState, useEffect, useRef } from "react"
import { useAccount, useWalletClient } from "wagmi"
import { ethers } from "ethers"

// Importing ABIs
import nftAbi from "../constants/BasicNft.json"
import marketplaceAbi from "../constants/Marketplace.json"
import networkMapping from "../constants/networkMapping.json"
import { useChainId } from "wagmi"

const styles = {
    pageWrapper: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #0d1b3e 70%, #0c0c1e 100%)",
        position: "relative",
        overflow: "hidden",
        paddingBottom: "60px",
    },

    orb1: {
        position: "fixed",
        top: "-120px",
        left: "-120px",
        width: "500px",
        height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
        filter: "blur(60px)",
        animation: "floatOrb1 12s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 0,
    },
    orb2: {
        position: "fixed",
        bottom: "-100px",
        right: "-100px",
        width: "460px",
        height: "460px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)",
        filter: "blur(70px)",
        animation: "floatOrb2 14s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 0,
    },
    orb3: {
        position: "fixed",
        top: "40%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "380px",
        height: "380px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)",
        filter: "blur(80px)",
        animation: "floatOrb3 18s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 0,
    },

    content: {
        position: "relative",
        zIndex: 1,
        maxWidth: "960px",
        margin: "0 auto",
        padding: "40px 20px",
    },

    heroTitle: {
        fontSize: "2.6rem",
        fontWeight: "800",
        letterSpacing: "-0.5px",
        background: "linear-gradient(90deg, #a78bfa, #818cf8, #38bdf8)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        marginBottom: "6px",
    },
    heroSub: {
        color: "#94a3b8",
        fontSize: "1rem",
        marginBottom: "40px",
    },

    card: {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderRadius: "20px",
        padding: "28px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
    },

    sectionTitle: {
        fontSize: "1.25rem",
        fontWeight: "700",
        color: "#e2e8f0",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    sectionIcon: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        fontSize: "1rem",
    },

    /* Input field */
    input: {
        width: "100%",
        padding: "11px 14px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "10px",
        color: "#e2e8f0",
        fontSize: "0.9rem",
        outline: "none",
        marginBottom: "12px",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxSizing: "border-box",
    },

    /* Buttons */
    btnIndigo: {
        width: "100%",
        padding: "11px 0",
        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
        color: "#fff",
        fontWeight: "600",
        fontSize: "0.95rem",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.15s, box-shadow 0.2s",
        boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
    },
    btnRed: {
        width: "100%",
        padding: "11px 0",
        background: "linear-gradient(135deg, #ef4444, #b91c1c)",
        color: "#fff",
        fontWeight: "600",
        fontSize: "0.95rem",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.15s, box-shadow 0.2s",
        boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
    },
    btnGreen: {
        width: "100%",
        padding: "11px 0",
        background: "linear-gradient(135deg, #22c55e, #15803d)",
        color: "#fff",
        fontWeight: "600",
        fontSize: "0.95rem",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.15s, box-shadow 0.2s",
        boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
    },
    btnCyan: {
        padding: "10px 22px",
        background: "linear-gradient(135deg, #0891b2, #0e7490)",
        color: "#fff",
        fontWeight: "600",
        fontSize: "0.9rem",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.15s, box-shadow 0.2s",
        boxShadow: "0 4px 16px rgba(8,145,178,0.45)",
    },
    btnDisabled: {
        opacity: 0.45,
        cursor: "not-allowed",
    },

    /* Proceeds balance chip */
    balanceChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(99,102,241,0.15)",
        border: "1px solid rgba(99,102,241,0.35)",
        borderRadius: "999px",
        padding: "6px 16px",
        color: "#a5b4fc",
        fontWeight: "600",
        fontSize: "0.95rem",
        marginBottom: "16px",
    },

    /* Listing info box */
    infoBox: {
        background: "rgba(34,197,94,0.07)",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: "12px",
        padding: "14px 16px",
        marginBottom: "14px",
        color: "#86efac",
        fontSize: "0.9rem",
        lineHeight: "1.7",
    },

    /* Toast */
    toastBase: {
        position: "fixed",
        top: "80px",
        right: "20px",
        zIndex: 9999,
        minWidth: "260px",
        maxWidth: "360px",
        padding: "14px 18px",
        borderRadius: "14px",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "10px",
        fontSize: "0.88rem",
        fontWeight: "500",
        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
        animation: "slideInToast 0.3s ease",
    },
    toastSuccess: {
        background: "rgba(20,83,45,0.85)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "rgba(34,197,94,0.4)",
        color: "#86efac",
    },
    toastError: {
        background: "rgba(127,29,29,0.85)",
        border: "1px solid rgba(239,68,68,0.4)",
        color: "#fca5a5",
    },
    toastInfo: {
        background: "rgba(30,27,75,0.9)",
        border: "1px solid rgba(99,102,241,0.4)",
        color: "#c7d2fe",
    },

    /* Modal */
    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modalBox: {
        background: "linear-gradient(135deg, #1e1b4b, #1e293b)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "20px",
        padding: "32px",
        maxWidth: "380px",
        width: "90%",
        textAlign: "center",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
    },

    /* 2-col grid */
    grid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
        marginBottom: "24px",
    },
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function SellNft() {
    const chainId = useChainId()
    const { address, isConnected } = useAccount()
    const { data: walletClient } = useWalletClient()

    const [status, setStatus] = useState("")
    const [mounted, setMounted] = useState(false)
    const [txStep, setTxStep] = useState("")

    const [nftAddress, setNftAddress] = useState("")
    const [tokenId, setTokenId] = useState("")
    const [price, setPrice] = useState("")

    const [loading, setLoading] = useState(false)
    const [cancelNftAddress, setCancelNftAddress] = useState("")
    const [cancelTokenId, setCancelTokenId] = useState("")
    const [showConfirmCancel, setShowConfirmCancel] = useState(false)

    const [proceeds, setProceeds] = useState(null)

    const [updateNftAddress, setUpdateNftAddress] = useState("")
    const [updateTokenId, setUpdateTokenId] = useState("")
    const [listing, setListing] = useState(null)
    const [newPrice, setNewPrice] = useState("")

    const [toast, setToast] = useState({ message: "", type: "info", visible: false })
    const toastTimerRef = useRef(null)

    // Input focus glow
    const [focusedInput, setFocusedInput] = useState(null)

    const marketplaceAddress = networkMapping[chainId]?.NftMarketplace?.[0]

    if (!marketplaceAddress) {
        return (
            <p style={{ color: "#fff", textAlign: "center" }}>
                Marketplace not deployed on this network
            </p>
        )
    }

    const SEPOLIA_CHAIN_ID = 11155111

    if (isConnected && chainId !== SEPOLIA_CHAIN_ID) {
        return (
            <p style={{ color: "#fff", textAlign: "center" }}>Please switch to Sepolia Network</p>
        )
    }

    const inputStyle = (id) => ({
        ...styles.input,
        ...(focusedInput === id
            ? {
                  border: "1px solid rgba(99,102,241,0.7)",
                  boxShadow: "0 0 0 3px rgba(99,102,241,0.2)",
              }
            : {}),
    })

    const showToast = (message, type = "info", duration = 4500) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast({ message, type, visible: true })
        toastTimerRef.current = setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }))
        }, duration)
    }

    const inferTypeFromMessage = (msg) => {
        if (!msg) return "info"
        if (msg.includes("✅")) return "success"
        if (msg.includes("❌") || /error/i.test(msg)) return "error"
        return "info"
    }

    useEffect(() => {
        if (status && typeof status === "string") {
            showToast(status, inferTypeFromMessage(status))
        }
    }, [status])

    // get the marketplace contract
    async function getMarketplaceContract(walletClient, withSigner = true) {
        const provider = new ethers.BrowserProvider(walletClient)

        if (withSigner) {
            const signer = await provider.getSigner()
            return new ethers.Contract(marketplaceAddress, marketplaceAbi, signer)
        }

        return new ethers.Contract(marketplaceAddress, marketplaceAbi, provider)
    }

    // get the NFT contract
    async function getNftContract(walletClient, nftAddress) {
        const provider = new ethers.BrowserProvider(walletClient)
        const signer = await provider.getSigner()
        return new ethers.Contract(nftAddress, nftAbi, signer)
    }

    /* ── Fetch proceeds ── */
    const fetchProceeds = async () => {
        if (!walletClient || !address) return
        try {
            const marketplaceContract = await getMarketplaceContract(walletClient, true)
            const userProceeds = await marketplaceContract.getProceeds(address)
            setProceeds(ethers.formatEther(userProceeds))
        } catch (err) {
            console.error("Error fetching proceeds:", err)
        }
    }

    /* ── List NFT ── */
    const handleListItem = async () => {
        if (!walletClient) return

        setLoading(true)
        setTxStep("")

        try {
            const nftContract = await getNftContract(walletClient, nftAddress)
            const marketplaceContract = await getMarketplaceContract(walletClient, true)

            const approved = await nftContract.getApproved(tokenId)

            if (approved.toLowerCase() !== marketplaceAddress.toLowerCase()) {
                setTxStep("🔐 Approving NFT...")
                const approveTx = await nftContract.approve(marketplaceAddress, tokenId)
                await approveTx.wait()
            }

            setTxStep("📤 Listing NFT...")

            const tx = await marketplaceContract.listItem(
                nftAddress,
                tokenId,
                ethers.parseEther(price)
            )

            await tx.wait()

            setTxStep("✅ NFT Listed Successfully!")

            // optional reset
            setNftAddress("")
            setTokenId("")
            setPrice("")
        } catch (err) {
            console.error(err)
            setTxStep("❌ Transaction Failed")
        } finally {
            setLoading(false)
        }
    }

    /* ── Cancel Listing ── */
    const handleCancelListing = async () => {
        if (!walletClient) return
        try {
            setStatus("Canceling listing...")
            const marketplaceContract = await getMarketplaceContract(walletClient, true)
            const existingListing = await marketplaceContract.getListing(
                cancelNftAddress,
                cancelTokenId
            )
            if (existingListing.price.toString() === "0") {
                setStatus("⚠️ This NFT is not listed")
                setShowConfirmCancel(false)
                return
            }
            const tx = await marketplaceContract.cancelListing(cancelNftAddress, cancelTokenId)
            await tx.wait()
            setStatus("✅ NFT successfully canceled!")
            setCancelNftAddress("")
            setCancelTokenId("")
            setShowConfirmCancel(false)
        } catch (err) {
            console.error(err)
            setStatus("❌ Error: " + err.message)
            setShowConfirmCancel(false)
        }
    }

    /* ── Withdraw ── */
    const handleWithdraw = async () => {
        if (!walletClient) return
        try {
            const marketplaceContract = await getMarketplaceContract(walletClient, true)
            setStatus("Withdrawing Proceeds...")
            const tx = await marketplaceContract.withdrawProceeds()
            await tx.wait()
            setStatus("✅ Withdrawal Successful!")
            fetchProceeds()
        } catch (err) {
            console.error(err)
            setStatus("❌ Error: " + err.message)
        }
    }

    /* ── Check / Update Listing ── */
    async function checkListing() {
        if (!walletClient || !updateNftAddress || updateTokenId === "") return
        try {
            setStatus("Checking listing...")
            const marketplaceContract = await getMarketplaceContract(walletClient, true)
            const listingData = await marketplaceContract.getListing(
                updateNftAddress,
                updateTokenId
            )
            if (listingData.price > 0) {
                setListing({
                    price: ethers.formatEther(listingData.price),
                    seller: listingData.seller,
                })
                setStatus("")
            } else {
                setListing(null)
                setStatus("❌ This NFT is not listed.")
            }
        } catch (err) {
            console.error(err)
            setStatus("⚠️ Error checking listing.")
        }
    }

    async function updateListing() {
        if (!walletClient || !updateNftAddress || !updateTokenId || !newPrice) return
        try {
            setStatus("Updating listing...")
            const marketplaceContract = await getMarketplaceContract(walletClient, true)
            const tx = await marketplaceContract.updateListing(
                updateNftAddress,
                updateTokenId,
                ethers.parseEther(newPrice)
            )
            await tx.wait()
            setStatus("✅ Listing updated successfully!")
            setListing({ ...listing, price: newPrice })
        } catch (err) {
            console.error(err)
            setStatus(" Failed to update listing.")
        }
    }

    useEffect(() => setMounted(true), [])
    if (!mounted)
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "#0f0c29",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6366f1",
                    fontSize: "1.1rem",
                }}
            >
                Loading...
            </div>
        )

    const toastStyle =
        toast.type === "success"
            ? styles.toastSuccess
            : toast.type === "error"
            ? styles.toastError
            : styles.toastInfo

    return (
        <>
            {/* ── Keyframe animations injected via <style> ── */}
            <style>{`
        @keyframes floatOrb1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(60px,40px) scale(1.08); }
          66%      { transform: translate(-30px,60px) scale(0.94); }
        }
        @keyframes floatOrb2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-50px,-60px) scale(1.1); }
          70%      { transform: translate(40px,-20px) scale(0.92); }
        }
        @keyframes floatOrb3 {
          0%,100% { transform: translateX(-50%) scale(1); }
          50%      { transform: translateX(-50%) scale(1.12) translateY(-30px); }
        }
        @keyframes slideInToast {
          from { opacity:0; transform: translateX(40px); }
          to   { opacity:1; transform: translateX(0); }
        }
        input::placeholder { color: rgba(148,163,184,0.55); }
        input:focus { outline: none; }
        button:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        button:active:not(:disabled) { transform: translateY(0); }
      `}</style>

            <div style={styles.pageWrapper}>
                {/* Glowing orbs */}
                <div style={styles.orb1} />
                <div style={styles.orb2} />
                <div style={styles.orb3} />

                {/* Toast */}
                {toast.visible && (
                    <div style={{ ...styles.toastBase, ...toastStyle }}>
                        <span>{toast.message}</span>
                        <button
                            onClick={() => setToast((p) => ({ ...p, visible: false }))}
                            style={{
                                background: "none",
                                border: "none",
                                color: "inherit",
                                cursor: "pointer",
                                fontSize: "1rem",
                                lineHeight: 1,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div style={styles.content}>
                    {/* Hero heading */}
                    <h1 style={styles.heroTitle}>NFT Manager</h1>
                    <p style={styles.heroSub}>
                        List, cancel, update, or withdraw proceeds from your NFTs in one place.
                    </p>

                    {txStep && <p style={{ color: "#c7d2fe", marginBottom: "20px" }}>{txStep}</p>}

                    {/* ── TOP GRID: List + Cancel ── */}
                    <div
                        style={{
                            ...styles.grid2,
                            ...(typeof window !== "undefined" && window.innerWidth < 640
                                ? { gridTemplateColumns: "1fr" }
                                : {}),
                        }}
                    >
                        {/* List NFT card */}

                        <div style={styles.card}>
                            <h2 style={styles.sectionTitle}>List Your NFT</h2>
                            <input
                                type="text"
                                placeholder="NFT contract address"
                                value={nftAddress}
                                onChange={(e) => setNftAddress(e.target.value)}
                                onFocus={() => setFocusedInput("nft-addr")}
                                onBlur={() => setFocusedInput(null)}
                                style={inputStyle("nft-addr")}
                            />
                            <input
                                type="text"
                                placeholder="Token ID"
                                value={tokenId}
                                onChange={(e) => setTokenId(e.target.value)}
                                onFocus={() => setFocusedInput("nft-tid")}
                                onBlur={() => setFocusedInput(null)}
                                style={inputStyle("nft-tid")}
                            />
                            <input
                                type="text"
                                placeholder="Price in ETH (e.g. 0.05)"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                onFocus={() => setFocusedInput("nft-price")}
                                onBlur={() => setFocusedInput(null)}
                                style={inputStyle("nft-price")}
                            />
                            <button
                                onClick={handleListItem}
                                disabled={!isConnected || loading}
                                style={{
                                    ...styles.btnIndigo,
                                    ...(!isConnected || loading ? styles.btnDisabled : {}),
                                }}
                            >
                                {loading
                                    ? "Processing..."
                                    : isConnected
                                    ? "List NFT"
                                    : "Connect Wallet to List"}
                            </button>
                        </div>

                        {/* Cancel Listing card */}
                        <div style={styles.card}>
                            <h2 style={styles.sectionTitle}>Cancel Listing</h2>
                            <input
                                type="text"
                                placeholder="NFT contract address"
                                value={cancelNftAddress}
                                onChange={(e) => setCancelNftAddress(e.target.value)}
                                onFocus={() => setFocusedInput("cancel-addr")}
                                onBlur={() => setFocusedInput(null)}
                                style={inputStyle("cancel-addr")}
                            />
                            <input
                                type="text"
                                placeholder="Token ID"
                                value={cancelTokenId}
                                onChange={(e) => setCancelTokenId(e.target.value)}
                                onFocus={() => setFocusedInput("cancel-tid")}
                                onBlur={() => setFocusedInput(null)}
                                style={inputStyle("cancel-tid")}
                            />
                            <button
                                onClick={() => {
                                    if (!cancelNftAddress || !cancelTokenId) {
                                        setStatus(
                                            "⚠️ Enter NFT address and Token ID before canceling"
                                        )
                                        return
                                    }
                                    setShowConfirmCancel(true)
                                }}
                                disabled={!isConnected}
                                style={{
                                    ...styles.btnRed,
                                    ...(!isConnected ? styles.btnDisabled : {}),
                                }}
                            >
                                {isConnected ? "Cancel Listing" : "Connect Wallet"}
                            </button>
                        </div>
                    </div>

                    {/* ── Update Listing card ── */}
                    <div style={{ ...styles.card, marginBottom: "24px" }}>
                        <h2 style={styles.sectionTitle}>Update Listing Price</h2>
                        <div style={styles.grid2}>
                            <input
                                type="text"
                                placeholder="NFT contract address"
                                value={updateNftAddress}
                                onChange={(e) => setUpdateNftAddress(e.target.value)}
                                onFocus={() => setFocusedInput("upd-addr")}
                                onBlur={() => setFocusedInput(null)}
                                style={{ ...inputStyle("upd-addr"), marginBottom: 0 }}
                            />
                            <input
                                type="text"
                                placeholder="Token ID"
                                value={updateTokenId}
                                onChange={(e) => setUpdateTokenId(e.target.value)}
                                onFocus={() => setFocusedInput("upd-tid")}
                                onBlur={() => setFocusedInput(null)}
                                style={{ ...inputStyle("upd-tid"), marginBottom: 0 }}
                            />
                        </div>
                        <button
                            onClick={checkListing}
                            style={{
                                ...styles.btnIndigo,
                                marginBottom: "16px",
                                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                boxShadow: "0 4px 16px rgba(245,158,11,0.35)",
                            }}
                        >
                            Check Listing
                        </button>

                        {listing && (
                            <>
                                <div style={styles.infoBox}>
                                    <div>
                                        <strong>Listed by:</strong>{" "}
                                        <span
                                            style={{
                                                fontFamily: "monospace",
                                                fontSize: "0.82rem",
                                            }}
                                        >
                                            {listing.seller}
                                        </span>
                                    </div>
                                    <div>
                                        {" "}
                                        <strong>Current Price:</strong> {listing.price} ETH
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="New Price in ETH"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    onFocus={() => setFocusedInput("new-price")}
                                    onBlur={() => setFocusedInput(null)}
                                    style={inputStyle("new-price")}
                                />
                                <button onClick={updateListing} style={styles.btnGreen}>
                                    Update Price
                                </button>
                            </>
                        )}
                    </div>

                    {/* ── Proceeds card ── */}
                    <div style={styles.card}>
                        <h2 style={styles.sectionTitle}>Your Proceeds</h2>
                        {proceeds !== null && (
                            <div style={styles.balanceChip}>
                                <span>💰</span>
                                <span>{proceeds} ETH</span>
                            </div>
                        )}
                        {proceeds === null && (
                            <p
                                style={{
                                    color: "#64748b",
                                    fontSize: "0.88rem",
                                    marginBottom: "16px",
                                }}
                            >
                                Click "Check Balance" to see your available proceeds.
                            </p>
                        )}
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            <button onClick={fetchProceeds} style={styles.btnCyan}>
                                Check Balance
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={!proceeds || parseFloat(proceeds) === 0}
                                style={{
                                    ...styles.btnIndigo,
                                    width: "auto",
                                    padding: "10px 22px",
                                    ...(!proceeds || parseFloat(proceeds) === 0
                                        ? styles.btnDisabled
                                        : {}),
                                }}
                            >
                                Withdraw
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Confirmation Modal ── */}
            {showConfirmCancel && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalBox}>
                        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⚠️</div>
                        <p
                            style={{
                                color: "#e2e8f0",
                                fontSize: "1.05rem",
                                fontWeight: "600",
                                marginBottom: "8px",
                            }}
                        >
                            Cancel this listing?
                        </p>
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "24px" }}>
                            This will remove your NFT from the marketplace. You can re-list it
                            anytime.
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <button
                                onClick={handleCancelListing}
                                style={{ ...styles.btnRed, width: "auto", padding: "10px 28px" }}
                            >
                                Yes, Cancel
                            </button>
                            <button
                                onClick={() => setShowConfirmCancel(false)}
                                style={{
                                    padding: "10px 28px",
                                    background: "rgba(255,255,255,0.08)",
                                    borderWidth: "1px",
                                    borderStyle: "solid",
                                    borderColor: "rgba(255,255,255,0.15)",
                                    borderRadius: "10px",
                                    color: "#cbd5e1",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                }}
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
