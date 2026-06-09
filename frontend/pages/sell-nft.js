"use client"

import { useState, useEffect, useRef } from "react"
import { useAccount, useWalletClient } from "wagmi"
import { ethers } from "ethers"
import nftAbi from "../constants/BasicNft.json"
import marketplaceAbi from "../constants/Marketplace.json"
import networkMapping from "../constants/networkMapping.json"
import { useChainId } from "wagmi"

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

    const marketplaceAddress = networkMapping[chainId]?.NftMarketplace?.[0]
    const SEPOLIA_CHAIN_ID = 11155111

    useEffect(() => setMounted(true), [])

    const showToast = (message, type = "info", duration = 4500) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast({ message, type, visible: true })
        toastTimerRef.current = setTimeout(
            () => setToast((p) => ({ ...p, visible: false })),
            duration
        )
    }

    const inferType = (msg) => {
        if (!msg) return "info"
        if (msg.includes("✅") || /success/i.test(msg)) return "success"
        if (msg.includes("❌") || /error/i.test(msg)) return "error"
        return "info"
    }

    useEffect(() => {
        if (status) showToast(status, inferType(status))
    }, [status])

    async function getMarketplaceContract(wc, withSigner = true) {
        const provider = new ethers.BrowserProvider(wc)
        if (withSigner) {
            const signer = await provider.getSigner()
            return new ethers.Contract(marketplaceAddress, marketplaceAbi, signer)
        }
        return new ethers.Contract(marketplaceAddress, marketplaceAbi, provider)
    }

    async function getNftContract(wc, addr) {
        const provider = new ethers.BrowserProvider(wc)
        const signer = await provider.getSigner()
        return new ethers.Contract(addr, nftAbi, signer)
    }

    const fetchProceeds = async () => {
        if (!walletClient || !address) return
        try {
            const mc = await getMarketplaceContract(walletClient, true)
            const amt = await mc.getProceeds(address)
            setProceeds(ethers.formatEther(amt))
        } catch (err) {
            console.error(err)
        }
    }

    const handleListItem = async () => {
        if (!walletClient) return
        setLoading(true)
        setTxStep("")
        try {
            const nftContract = await getNftContract(walletClient, nftAddress)
            const mc = await getMarketplaceContract(walletClient, true)
            const approved = await nftContract.getApproved(tokenId)
            if (approved.toLowerCase() !== marketplaceAddress.toLowerCase()) {
                setTxStep("→ Approving NFT transfer")
                const approveTx = await nftContract.approve(marketplaceAddress, tokenId)
                await approveTx.wait()
            }
            setTxStep("→ Broadcasting listing transaction")
            const tx = await mc.listItem(nftAddress, tokenId, ethers.parseEther(price))
            await tx.wait()
            setTxStep("✅ NFT listed successfully")
            setNftAddress("")
            setTokenId("")
            setPrice("")
        } catch (err) {
            console.error(err)
            setTxStep("❌ Transaction failed")
        } finally {
            setLoading(false)
        }
    }

    const handleCancelListing = async () => {
        if (!walletClient) return
        try {
            setStatus("Canceling listing...")
            const mc = await getMarketplaceContract(walletClient, true)
            const existing = await mc.getListing(cancelNftAddress, cancelTokenId)
            if (existing.price.toString() === "0") {
                setStatus("⚠️ This NFT is not listed")
                setShowConfirmCancel(false)
                return
            }
            const tx = await mc.cancelListing(cancelNftAddress, cancelTokenId)
            await tx.wait()
            setStatus("✅ Listing canceled successfully")
            setCancelNftAddress("")
            setCancelTokenId("")
            setShowConfirmCancel(false)
        } catch (err) {
            console.error(err)
            setStatus("❌ Error: " + err.message)
            setShowConfirmCancel(false)
        }
    }

    const handleWithdraw = async () => {
        if (!walletClient) return
        try {
            setStatus("Processing withdrawal...")
            const mc = await getMarketplaceContract(walletClient, true)
            const tx = await mc.withdrawProceeds()
            await tx.wait()
            setStatus("✅ Withdrawal successful")
            fetchProceeds()
        } catch (err) {
            console.error(err)
            setStatus("❌ Error: " + err.message)
        }
    }

    async function checkListing() {
        if (!walletClient || !updateNftAddress || updateTokenId === "") return
        try {
            const mc = await getMarketplaceContract(walletClient, true)
            const data = await mc.getListing(updateNftAddress, updateTokenId)
            if (data.price > 0) {
                setListing({ price: ethers.formatEther(data.price), seller: data.seller })
                setStatus("")
            } else {
                setListing(null)
                setStatus("❌ NFT is not listed")
            }
        } catch (err) {
            console.error(err)
            setStatus("⚠️ Error checking listing")
        }
    }

    async function updateListing() {
        if (!walletClient || !updateNftAddress || !updateTokenId || !newPrice) return
        try {
            setStatus("Updating listing...")
            const mc = await getMarketplaceContract(walletClient, true)
            const tx = await mc.updateListing(
                updateNftAddress,
                updateTokenId,
                ethers.parseEther(newPrice)
            )
            await tx.wait()
            setStatus("✅ Listing updated successfully")
            setListing({ ...listing, price: newPrice })
        } catch (err) {
            console.error(err)
            setStatus("❌ Update failed")
        }
    }

    if (!mounted) {
        return (
            <div style={S.centerWrap}>
                <span className="mono" style={S.dimText}>
                    LOADING...
                </span>
            </div>
        )
    }

    if (!marketplaceAddress) {
        return (
            <div style={S.centerWrap}>
                <p style={S.errCode}>ERR // NO_DEPLOYMENT</p>
                <p style={S.errMsg}>Marketplace not deployed on this network.</p>
            </div>
        )
    }

    if (isConnected && chainId !== SEPOLIA_CHAIN_ID) {
        return (
            <div style={S.centerWrap}>
                <p style={S.errCode}>ERR // WRONG_NETWORK</p>
                <p style={S.errMsg}>Connect to Sepolia testnet to continue.</p>
            </div>
        )
    }

    const toastVariant =
        toast.type === "success"
            ? S.toastSuccess
            : toast.type === "error"
            ? S.toastError
            : S.toastInfo

    return (
        <>
            <div style={S.page}>
                {/* Toast */}
                {toast.visible && (
                    <div style={{ ...S.toastBase, ...toastVariant }}>
                        <span>{toast.message}</span>
                        <button
                            onClick={() => setToast((p) => ({ ...p, visible: false }))}
                            style={S.toastClose}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div style={S.content}>
                    {/* Page header */}
                    <div style={{ marginBottom: "32px" }}>
                        <p className="mono" style={S.pageTitle}>
                            NFT.MANAGER
                        </p>
                        <p style={S.pageSub}>Manage listings and proceeds on Sepolia</p>
                    </div>

                    {txStep && (
                        <p className="mono" style={S.txStep}>
                            {txStep}
                        </p>
                    )}

                    {/* Row 1: List + Cancel */}
                    <div className="grid-2">
                        {/* List NFT */}
                        <div className="panel">
                            <p className="section-label">List NFT</p>
                            <input
                                className="field"
                                type="text"
                                placeholder="NFT contract address"
                                value={nftAddress}
                                onChange={(e) => setNftAddress(e.target.value)}
                            />
                            <input
                                className="field"
                                type="text"
                                placeholder="Token ID"
                                value={tokenId}
                                onChange={(e) => setTokenId(e.target.value)}
                            />
                            <input
                                className="field"
                                type="text"
                                placeholder="Price in ETH"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                            <button
                                className="btn btn-cyan btn-full"
                                style={{ marginTop: "4px" }}
                                onClick={handleListItem}
                                disabled={!isConnected || loading}
                            >
                                {loading
                                    ? "PROCESSING..."
                                    : isConnected
                                    ? "LIST NFT"
                                    : "CONNECT WALLET"}
                            </button>
                        </div>

                        {/* Cancel Listing */}
                        <div className="panel">
                            <p className="section-label">Cancel Listing</p>
                            <input
                                className="field"
                                type="text"
                                placeholder="NFT contract address"
                                value={cancelNftAddress}
                                onChange={(e) => setCancelNftAddress(e.target.value)}
                            />
                            <input
                                className="field"
                                type="text"
                                placeholder="Token ID"
                                value={cancelTokenId}
                                onChange={(e) => setCancelTokenId(e.target.value)}
                            />
                            <button
                                className="btn btn-red btn-full"
                                style={{ marginTop: "4px" }}
                                onClick={() => {
                                    if (!cancelNftAddress || !cancelTokenId) {
                                        setStatus("⚠️ Enter NFT address and Token ID")
                                        return
                                    }
                                    setShowConfirmCancel(true)
                                }}
                                disabled={!isConnected}
                            >
                                {isConnected ? "CANCEL LISTING" : "CONNECT WALLET"}
                            </button>
                        </div>
                    </div>

                    {/* Update Listing */}
                    <div className="panel" style={{ marginBottom: "16px" }}>
                        <p className="section-label">Update Listing Price</p>
                        <div className="grid-2" style={{ marginBottom: "12px" }}>
                            <input
                                className="field"
                                type="text"
                                placeholder="NFT contract address"
                                value={updateNftAddress}
                                onChange={(e) => setUpdateNftAddress(e.target.value)}
                                style={{ marginBottom: 0 }}
                            />
                            <input
                                className="field"
                                type="text"
                                placeholder="Token ID"
                                value={updateTokenId}
                                onChange={(e) => setUpdateTokenId(e.target.value)}
                                style={{ marginBottom: 0 }}
                            />
                        </div>
                        <button className="btn btn-ghost" onClick={checkListing}>
                            CHECK LISTING
                        </button>

                        {listing && (
                            <div style={{ marginTop: "16px" }}>
                                <div style={S.listingInfo}>
                                    <span style={S.infoLabel}>Seller</span>
                                    <span className="mono" style={S.infoValue}>
                                        {listing.seller}
                                    </span>
                                    <span style={S.infoLabel}>Current Price</span>
                                    <span className="mono" style={{ ...S.infoValue, color: "#a855f7" }}>
                                        {listing.price} ETH
                                    </span>
                                </div>
                                <input
                                    className="field"
                                    type="text"
                                    placeholder="New price in ETH"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                />
                                <button className="btn btn-green" onClick={updateListing}>
                                    UPDATE PRICE
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Proceeds */}
                    <div className="panel">
                        <p className="section-label">Proceeds</p>
                        {proceeds !== null ? (
                            <p className="mono" style={S.proceedsAmt}>
                                {proceeds} ETH
                            </p>
                        ) : (
                            <p style={S.proceedsEmpty}>
                                Run check balance to view your available proceeds.
                            </p>
                        )}
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button className="btn btn-ghost" onClick={fetchProceeds}>
                                CHECK BALANCE
                            </button>
                            <button
                                className="btn btn-cyan"
                                onClick={handleWithdraw}
                                disabled={!proceeds || parseFloat(proceeds) === 0}
                            >
                                WITHDRAW
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmCancel && (
                <div style={S.modalOverlay}>
                    <div style={S.modalBox}>
                        <p style={S.modalTitle} className="mono">
                            CONFIRM CANCELLATION
                        </p>
                        <p style={S.modalBody}>
                            Delist token #{cancelTokenId} from the marketplace?
                        </p>
                        <p style={S.modalSub}>
                            This removes the listing. You may re-list at any time.
                        </p>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button className="btn btn-red" onClick={handleCancelListing}>
                                YES, CANCEL
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowConfirmCancel(false)}
                            >
                                GO BACK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

const S = {
    page: {
        position: "relative",
        zIndex: 1,
        minHeight: "calc(100vh - 64px)",
    },
    content: {
        maxWidth: "880px",
        margin: "0 auto",
        padding: "40px 24px 64px",
    },
    pageTitle: {
        fontSize: "0.9rem",
        fontWeight: "600",
        letterSpacing: "0.14em",
        color: "#e6edf3",
        marginBottom: "4px",
    },
    pageSub: {
        fontSize: "0.78rem",
        color: "#9a9a9a",
        letterSpacing: "0.04em",
    },
    txStep: {
        fontSize: "0.75rem",
        color: "#d8b4fe",
        letterSpacing: "0.06em",
        marginBottom: "20px",
    },
    listingInfo: {
        background: "rgba(168, 85, 247, 0.06)",
        border: "1px solid rgba(168, 85, 247, 0.18)",
        borderRadius: "8px",
        padding: "14px 16px",
        marginBottom: "14px",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "6px 16px",
        alignItems: "center",
    },
    infoLabel: {
        fontSize: "0.65rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#6c7589",
    },
    infoValue: {
        fontSize: "0.78rem",
        color: "#ffffff",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    proceedsAmt: {
        fontSize: "2rem",
        fontWeight: "700",
        background: "linear-gradient(90deg, #a855f7, #d8b4fe, #ffffff)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        letterSpacing: "-0.02em",
        marginBottom: "16px",
    },
    proceedsEmpty: {
        fontSize: "0.78rem",
        color: "#6c7589",
        marginBottom: "16px",
        letterSpacing: "0.03em",
    },
    /* Toast */
    toastBase: {
        position: "fixed",
        top: "76px",
        right: "20px",
        zIndex: 9999,
        minWidth: "260px",
        maxWidth: "400px",
        padding: "13px 16px",
        borderRadius: "10px",
        background: "rgba(5, 5, 10, 0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        fontSize: "0.75rem",
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        letterSpacing: "0.04em",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
        animation: "slideInToast 0.25s ease",
    },
    toastSuccess: {
        borderTop: "1px solid rgba(63, 185, 80, 0.2)",
        borderRight: "1px solid rgba(63, 185, 80, 0.2)",
        borderBottom: "1px solid rgba(63, 185, 80, 0.2)",
        borderLeft: "3px solid #3fb950",
        color: "#3fb950",
    },
    toastError: {
        borderTop: "1px solid rgba(248, 81, 73, 0.2)",
        borderRight: "1px solid rgba(248, 81, 73, 0.2)",
        borderBottom: "1px solid rgba(248, 81, 73, 0.2)",
        borderLeft: "3px solid #f85149",
        color: "#f85149",
    },
    toastInfo: {
        borderTop: "1px solid rgba(168, 85, 247, 0.2)",
        borderRight: "1px solid rgba(168, 85, 247, 0.2)",
        borderBottom: "1px solid rgba(168, 85, 247, 0.2)",
        borderLeft: "3px solid #a855f7",
        color: "#d8b4fe",
    },
    toastClose: {
        background: "none",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        fontSize: "0.82rem",
        opacity: 0.55,
        lineHeight: 1,
        flexShrink: 0,
    },
    /* Modal */
    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modalBox: {
        background: "#0e0b1a",
        border: "1px solid rgba(168, 85, 247, 0.25)",
        borderRadius: "14px",
        padding: "32px",
        maxWidth: "380px",
        width: "90%",
        textAlign: "center",
        boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), 0 0 40px rgba(168, 85, 247, 0.08)",
    },
    modalTitle: {
        fontSize: "0.65rem",
        fontWeight: "700",
        color: "#f85149",
        letterSpacing: "0.14em",
        borderLeft: "2px solid #f85149",
        paddingLeft: "10px",
        textAlign: "left",
        marginBottom: "16px",
    },
    modalBody: {
        color: "#ffffff",
        fontSize: "0.92rem",
        fontWeight: "600",
        marginBottom: "8px",
    },
    modalSub: {
        color: "#9a9a9a",
        fontSize: "0.8rem",
        marginBottom: "24px",
        lineHeight: "1.65",
    },
    /* Error / loading states */
    centerWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        gap: "8px",
        position: "relative",
        zIndex: 1,
    },
    dimText: {
        fontSize: "0.7rem",
        letterSpacing: "0.16em",
        color: "#6c7589",
    },
    errCode: {
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: "0.68rem",
        letterSpacing: "0.15em",
        color: "#f85149",
    },
    errMsg: {
        fontSize: "0.82rem",
        color: "#8b949e",
    },
}
