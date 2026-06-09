import { ConnectButton } from "@rainbow-me/rainbowkit"
import Link from "next/link"
import { useEffect } from "react"
import { useAccount, useChainId, useSwitchChain } from "wagmi"

const S = {
    nav: {
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#000000",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "0 28px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    logo: {
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: "1.25rem",
        fontWeight: "700",
        letterSpacing: "0.06em",
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "linear-gradient(90deg, #a855f7 0%, #d8b4fe 50%, #ffffff 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    bracket: {
        background: "linear-gradient(90deg, #a855f7, #d8b4fe)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        opacity: 0.7,
    },
    links: {
        display: "flex",
        alignItems: "center",
        gap: "28px",
    },
    link: {
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: "0.68rem",
        fontWeight: "600",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textDecoration: "none",
        background: "linear-gradient(90deg, #a855f7 0%, #d8b4fe 50%, #ffffff 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
}

export default function Header() {
    const { isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()

    useEffect(() => {
        if (!isConnected) return
        if (chainId !== 31337 && chainId !== 11155111) {
            switchChain({ chainId: 11155111 }).catch((err) => {
                console.warn("Switch chain failed:", err.message)
            })
        }
    }, [isConnected, chainId, switchChain])

    return (
        <nav style={S.nav}>
            <Link href="/" style={S.logo}>
                <span style={S.bracket}>[</span>
                NFT.MKT
                <span style={S.bracket}>]</span>
            </Link>

            <div style={S.links}>
                <Link href="/" style={S.link}>
                    Market
                </Link>
                <Link href="/sell-nft" style={S.link}>
                    Manage
                </Link>
                <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
            </div>
        </nav>
    )
}
