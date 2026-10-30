"use client"

import { useState, useEffect } from "react"
import {
  Link2,
  QrCode,
  Copy,
  Check,
  Trash2,
  History,
  Sparkles,
  ExternalLink,
  Zap,
  Globe,
  Download,
  Search,
  Lock,
  ArrowRight,
  ChevronLeft,
  Loader2,
  Mail,
  User as UserIcon,
  Key,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

interface HistoryItem {
  id: string
  type: "redirect" | "utm"
  title: string
  originalUrl: string
  generatedUrl: string
  createdAt: string
}

interface UserProfile {
  id: string
  email: string
  fullName: string
  role: "user" | "admin"
  paymentStatus: "pending" | "verified" | "rejected"
}

function LegacyHome() {
  const [isClient, setIsClient] = useState(false)
  const [origin, setOrigin] = useState("http://localhost:3000")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Landing / Gate state
  const [gateTab, setGateTab] = useState<"checkout" | "register" | "login">("checkout")
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [downloadingQr, setDownloadingQr] = useState(false)

  // Registration Form States
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [regHash, setRegHash] = useState("")
  const [regWallet, setRegWallet] = useState("")
  const [regLoading, setRegLoading] = useState(false)

  // Login Form States
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  // State for Smart Redirect Linker
  const [redirectTarget, setRedirectTarget] = useState("")
  const [redirectType, setRedirectType] = useState<"clean" | "secure">("secure")
  const [customAlias, setCustomAlias] = useState("")

  // State for UTM Builder
  const [utmTarget, setUtmTarget] = useState("")
  const [utmSource, setUtmSource] = useState("")
  const [utmMedium, setUtmMedium] = useState("")
  const [utmCampaign, setUtmCampaign] = useState("")
  const [utmTerm, setUtmTerm] = useState("")
  const [utmContent, setUtmContent] = useState("")
  const [utmAlias, setUtmAlias] = useState("")

  // Active Generated Link
  const [activeLink, setActiveLink] = useState("")
  const [activeStatsUrl, setActiveStatsUrl] = useState("")
  const [copiedLink, setCopiedLink] = useState(false)

  const walletAddress = process.env.NEXT_PUBLIC_PAYMENT_WALLET_ADDRESS || ""

  useEffect(() => {
    setIsClient(true)
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }

    checkSession()

    // Periodically fetch session details to pick up status changes dynamically
    const interval = setInterval(checkSession, 2000)
    return () => clearInterval(interval)
  }, [])

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          setUser(data.user)
          setIsPremium(data.user.role === "admin" || data.user.paymentStatus === "verified")

          // Load History
          const savedHistory = localStorage.getItem("gaur_link_history")
          if (savedHistory) {
            try {
              const parsed = JSON.parse(savedHistory)
              const isPrem = data.user.role === "admin" || data.user.paymentStatus === "verified"
              setHistory(isPrem ? parsed : parsed.slice(0, 5))
            } catch (e) {
              console.error(e)
            }
          }
        } else {
          setUser(null)
          setIsPremium(false)
        }
      }
    } catch (e) {
      console.error("Check session error:", e)
    } finally {
      setAuthLoading(false)
    }
  }

  // Save history helper
  const saveHistory = (newHistory: HistoryItem[]) => {
    let updated = newHistory
    if (!isPremium) {
      updated = newHistory.slice(0, 5)
    }
    setHistory(updated)
    localStorage.setItem("gaur_link_history", JSON.stringify(updated))
  }

  const createTrackedLink = async (targetUrl: string, alias?: string) => {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl, alias }),
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Unable to create tracked link")
    }

    const generatedUrl = `${origin}/${encodeURIComponent(data.code)}`
    setActiveStatsUrl(`${origin}/stats/${encodeURIComponent(data.code)}`)
    return generatedUrl
  }

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Link copied to clipboard!")
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const exportToCsv = () => {
    if (!isPremium) {
      toast.error("Premium feature! Upgrade to export history as CSV.")
      return
    }
    const headers = ["ID", "Type", "Title", "Original URL", "Generated URL", "Created At"]
    const rows = history.map((item) => [
      item.id,
      item.type,
      item.title,
      item.originalUrl,
      item.generatedUrl,
      item.createdAt,
    ])
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `gaur_links_history_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast.success("CSV file downloaded successfully!")
  }

  const handleCopyWalletAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    toast.success("Wallet Address copied!")
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const handleDownloadQr = () => {
    setDownloadingQr(true)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(walletAddress)}`
    fetch(qrUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "gaur_links_checkout_qr.png"
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.success("QR Code downloaded!")
        setDownloadingQr(false)
      })
      .catch(() => {
        window.open(qrUrl, "_blank")
        setDownloadingQr(false)
      })
  }

  // Handle registration submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (regPassword !== regConfirmPassword) {
      toast.error("Passwords do not match!")
      return
    }

    const hashRegex = /^[a-fA-F0-9]{64}$/
    if (!hashRegex.test(regHash.trim())) {
      toast.error("Invalid Transaction Hash. Must be a 64-character TRON hex string.")
      return
    }

    setRegLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: regName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          transactionHash: regHash.trim(),
          walletAddress: regWallet.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        // Reset form
        setRegName("")
        setRegEmail("")
        setRegPassword("")
        setRegConfirmPassword("")
        setRegHash("")
        setRegWallet("")
        // Redirect to Login Tab
        setGateTab("login")
      } else {
        toast.error(data.error || "Registration failed")
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      setRegLoading(false)
    }
  }

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success("Logged in successfully!")
        setUser(data.user)
        setIsPremium(data.user.role === "admin" || data.user.paymentStatus === "verified")
      } else {
        toast.error(data.error || "Login failed")
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      setLoginLoading(false)
    }
  }

  // Generate Smart Redirect Link
  const handleGenerateRedirect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!redirectTarget) {
      toast.error("Please enter a destination URL")
      return
    }

    let targetUrl = redirectTarget.trim()
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl
    }

    try {
      new URL(targetUrl)
    } catch {
      toast.error("Please enter a valid URL")
      return
    }

    const alias = customAlias.trim().toLowerCase()
    if (alias && isPremium && !/^[a-zA-Z0-9_-]+$/.test(alias)) {
      toast.error("Custom alias must contain only letters, numbers, underscores, or dashes.")
      return
    }

    try {
      const generatedUrl = await createTrackedLink(targetUrl, alias && isPremium ? alias : undefined)
      setActiveLink(generatedUrl)

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        type: "redirect",
        title:
          alias && isPremium
            ? `Custom Redirect: /${alias}`
            : `Redirect to: ${new URL(targetUrl).hostname}`,
        originalUrl: targetUrl,
        generatedUrl,
        createdAt: new Date().toLocaleString(),
      }
      saveHistory([newItem, ...history])
      setCustomAlias("")
      toast.success("Redirect Link Generated!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create link")
    }
  }

  // Generate UTM Link
  const handleGenerateUtm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!utmTarget) {
      toast.error("Please enter a destination URL")
      return
    }

    let targetUrl = utmTarget.trim()
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl
    }

    try {
      const urlObj = new URL(targetUrl)
      if (utmSource) urlObj.searchParams.set("utm_source", utmSource)
      if (utmMedium) urlObj.searchParams.set("utm_medium", utmMedium)
      if (utmCampaign) urlObj.searchParams.set("utm_campaign", utmCampaign)
      if (utmTerm) urlObj.searchParams.set("utm_term", utmTerm)
      if (utmContent) urlObj.searchParams.set("utm_content", utmContent)

      const finalUrl = urlObj.toString()
      const alias = utmAlias.trim().toLowerCase()
      if (alias && isPremium && !/^[a-zA-Z0-9_-]+$/.test(alias)) {
        toast.error("Custom alias must contain only letters, numbers, underscores, or dashes.")
        return
      }
      const generatedUrl = await createTrackedLink(finalUrl, alias && isPremium ? alias : undefined)

      setActiveLink(generatedUrl)

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        type: "utm",
        title:
          alias && isPremium
            ? `Custom UTM: /${alias}`
            : `UTM Campaign for: ${urlObj.hostname}`,
        originalUrl: finalUrl,
        generatedUrl: generatedUrl,
        createdAt: new Date().toLocaleString(),
      }
      saveHistory([newItem, ...history])
      setUtmAlias("")
      toast.success("UTM Campaign Link Generated!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please enter a valid URL")
    }
  }

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter((item) => item.id !== id)
    saveHistory(updated)
    toast.success("Deleted from history")
  }

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      saveHistory([])
      toast.success("History cleared")
    }
  }

  const filteredHistory = history.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.originalUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.generatedUrl.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const downloadQrCode = (url: string, filename: string = "qrcode.png") => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`
    fetch(qrUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(blobUrl)
        toast.success("Downloading QR Code...")
      })
      .catch(() => {
        window.open(qrUrl, "_blank")
      })
  }

  if (!isClient || authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 font-sans"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Toaster position="top-right" theme="dark" />
      <Navbar />

      {/* Decorative Blur Backdrops */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="container mx-auto px-4 pt-32 pb-16 relative z-10 max-w-6xl">
        {/* CASE 1: NOT LOGGED IN - SHOW PAYMENT / AUTHENTICATION GATE */}
        {false ? (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8 animate-in fade-in duration-300">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold animate-pulse">
                <Lock className="w-4 h-4" /> Secure Marketer Workspace
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-indigo-400 to-purple-400">
                GAUR LINKS
              </h1>
              <p className="text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
                Activate Premium to unlock unlimited redirections, custom path aliases, UTM analytics tracking, QR codes,
                and CSV logs.
              </p>
            </div>

            <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden relative">
              <CardHeader className="border-b border-neutral-800 bg-neutral-900/40 p-4">
                <Tabs value={gateTab} onValueChange={(v) => setGateTab(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-neutral-950/60 p-1 border border-neutral-800 rounded-lg">
                    <TabsTrigger value="checkout" className="text-xs font-medium py-2 rounded-md transition-all cursor-pointer">
                      1. Pay 10 USDT
                    </TabsTrigger>
                    <TabsTrigger value="register" className="text-xs font-medium py-2 rounded-md transition-all cursor-pointer">
                      2. Register
                    </TabsTrigger>
                    <TabsTrigger value="login" className="text-xs font-medium py-2 rounded-md transition-all cursor-pointer">
                      3. Log In
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>

              <CardContent className="p-6 md:p-8">
                {/* Checkout Sub-View */}
                {gateTab === "checkout" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-950/60 border border-neutral-800">
                      <span className="text-xs font-semibold text-neutral-400 font-[family-name:var(--font-poppins)]">
                        Lifetime Premium Pass
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-indigo-400">10 USDT</span>
                        <span className="block text-[10px] text-neutral-500 font-medium">TRON (TRC20) Network</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-3 bg-neutral-950/30 p-4 rounded-xl border border-neutral-800/40">
                      <div className="p-3 bg-white rounded-xl shadow-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                            walletAddress
                          )}`}
                          alt="USDT TRC20 Recipient QR"
                          className="h-40 w-40"
                        />
                      </div>
                      <button
                        onClick={handleDownloadQr}
                        disabled={downloadingQr}
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        {downloadingQr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Download QR Code
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                        USDT Recipient Wallet
                      </label>
                      <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                        <span className="text-xs font-mono text-indigo-300 select-all truncate flex-grow">
                          {walletAddress}
                        </span>
                        <button
                          onClick={handleCopyWalletAddress}
                          className="p-1.5 text-neutral-400 hover:text-white rounded-md bg-neutral-900 border border-neutral-800 cursor-pointer"
                        >
                          {copiedAddress ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-yellow-500/80 leading-normal">
                        ⚠️ Send only **USDT (TRC20)** on the TRON network to this wallet. Sending other assets will cause permanent loss.
                      </p>
                    </div>

                    <button
                      onClick={() => setGateTab("register")}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      I've Sent Payment <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Register Sub-View */}
                {gateTab === "register" && (
                  <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in duration-200">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                        Full Name
                      </Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <Input
                          id="reg-name"
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <Input
                          id="reg-email"
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-pass" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                          Password
                        </Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                          <Input
                            id="reg-pass"
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Choose password..."
                            className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="reg-conf" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                          <Input
                            id="reg-conf"
                            type="password"
                            required
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            placeholder="Confirm password..."
                            className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-neutral-800 pt-4 mt-2">
                      <Label htmlFor="reg-hash" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block text-indigo-300">
                        Transaction Hash (TXID) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="reg-hash"
                        type="text"
                        required
                        value={regHash}
                        onChange={(e) => setRegHash(e.target.value)}
                        placeholder="TRC20 Transaction ID (64-char hex)..."
                        className="bg-neutral-950 border-neutral-800 text-white py-5 rounded-lg font-mono focus:ring-indigo-500 text-xs"
                      />
                      <p className="text-[10px] text-neutral-500">Provide the receipt identifier from your transaction.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reg-wallet" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                        Your Wallet Address <span className="text-neutral-500 font-normal">(Optional)</span>
                      </Label>
                      <Input
                        id="reg-wallet"
                        type="text"
                        value={regWallet}
                        onChange={(e) => setRegWallet(e.target.value)}
                        placeholder="Your sender wallet..."
                        className="bg-neutral-950 border-neutral-800 text-white py-5 rounded-lg font-mono focus:ring-indigo-500 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      {regLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
                        </>
                      ) : (
                        <>
                          Submit Proof & Create Account <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Log In Sub-View */}
                {gateTab === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-200">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <Input
                          id="login-email"
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="login-pass" className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                        Password
                      </Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <Input
                          id="login-pass"
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Enter password..."
                          className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Logging In...
                        </>
                      ) : (
                        <>
                          Log In <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* CASE 2: LOGGED IN USER CHECKLIST */
          <>
            {/* Case 2A: Payment is Pending */}
            {user && user.role === "user" && user.paymentStatus === "pending" && (
              <div className="max-w-md mx-auto py-12 animate-in fade-in duration-300">
                <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-xl p-8 text-center rounded-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -left-24 -z-10 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl"></div>
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 mb-6">
                    <History className="h-8 w-8 animate-spin" style={{ animationDuration: "4s" }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-[family-name:var(--font-poppins)] text-neutral-100">
                    Verification in Progress
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                    Your payment is under verification. Please wait for admin approval.
                  </p>
                  <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-xl text-left text-xs space-y-2 mb-6">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Account Email:</span>
                      <span className="text-neutral-300 font-semibold">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">License Cost:</span>
                      <span className="text-neutral-300 font-semibold font-mono">10 USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Status:</span>
                      <span className="text-yellow-500 font-bold">Pending Approval</span>
                    </div>
                  </div>
                  <Button onClick={checkSession} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-lg">
                    Check Verification Status
                  </Button>
                </Card>
              </div>
            )}

            {/* Case 2B: Payment is Rejected */}
            {user && user.role === "user" && user.paymentStatus === "rejected" && (
              <div className="max-w-md mx-auto py-12 animate-in fade-in duration-300">
                <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-xl p-8 text-center rounded-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -left-24 -z-10 h-48 w-48 rounded-full bg-red-500/10 blur-3xl"></div>
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20 mb-6">
                    <ShieldAlert className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-[family-name:var(--font-poppins)] text-neutral-100">
                    Verification Failed
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                    Payment verification failed. Please contact support or submit a new transaction.
                  </p>
                  <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-xl text-left text-xs space-y-2 mb-6">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Account Email:</span>
                      <span className="text-neutral-300 font-semibold">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Status:</span>
                      <span className="text-red-500 font-bold">Rejected</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 mb-6 leading-normal">
                    If this was a mistake, please reach out to admin support at `support@gaurlinks.com` with your registration transaction details.
                  </p>
                  <Button
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" })
                      setUser(null)
                      setIsPremium(false)
                      setGateTab("checkout")
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg"
                  >
                    Submit New Payment Receipt
                  </Button>
                </Card>
              </div>
            )}

            {/* Case 2C: User is Verified or is Admin - Reveal standard Workspace dashboard */}
            {(!user || user.role === "admin" || user.paymentStatus === "verified") && (
              <>
                {/* Header Hero */}
                <div className="text-center mb-12 animate-in fade-in duration-300">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4 animate-pulse">
                    <Sparkles className="w-4 h-4" />
                    Stateless Link Generation Workspace
                  </div>
                  <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-indigo-400 to-purple-400">
                    GAUR DYNAMIC LINKS
                  </h1>
                  <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                    Generate tracked redirection links and campaign UTM codes instantly with built-in QR code sharing.
                  </p>
                </div>

                {/* Workspace Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
                  {/* Form Side */}
                  <div className="lg:col-span-7 space-y-6">
                    <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-xl shadow-2xl overflow-hidden">
                      <CardHeader className="border-b border-neutral-800 bg-neutral-900/40 pb-4">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-indigo-300">
                          <Zap className="w-5 h-5 text-indigo-500" /> Link Builder Workspace
                        </CardTitle>
                        <CardDescription className="text-neutral-400">
                          Choose a tool below to generate your customized smart link.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <Tabs defaultValue="redirect" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 bg-neutral-950/60 p-1 border border-neutral-800 rounded-lg mb-6">
                            <TabsTrigger
                              value="redirect"
                              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-neutral-400 font-medium py-2 rounded-md transition-all duration-300 cursor-pointer"
                            >
                              <Link2 className="w-4 h-4 mr-2 inline" />
                              Smart Redirect
                            </TabsTrigger>
                            <TabsTrigger
                              value="utm"
                              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-neutral-400 font-medium py-2 rounded-md transition-all duration-300 cursor-pointer"
                            >
                              <Globe className="w-4 h-4 mr-2 inline" />
                              UTM Builder
                            </TabsTrigger>
                          </TabsList>

                          {/* Smart Redirect Form */}
                          <TabsContent value="redirect" className="mt-0">
                            <form onSubmit={handleGenerateRedirect} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="redirect-target" className="text-sm font-semibold text-neutral-300">
                                  Destination URL
                                </Label>
                                <Input
                                  id="redirect-target"
                                  placeholder="e.g. https://www.yourdomain.com/landing-page"
                                  value={redirectTarget}
                                  onChange={(e) => setRedirectTarget(e.target.value)}
                                  className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-500 py-6 pl-4 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
                                />
                                <p className="text-xs text-neutral-500">
                                  Visitors will instantly be forwarded here when clicking your generated link.
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="custom-alias" className="text-sm font-semibold text-neutral-300 flex items-center justify-between">
                                  <span>Custom Redirection Alias (Optional)</span>
                                  {!isPremium && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                                      PREMIUM
                                    </span>
                                  )}
                                </Label>
                                <Input
                                  id="custom-alias"
                                  placeholder={isPremium ? "e.g. promo-slug" : "Upgrade to Premium to unlock Custom Alias"}
                                  value={customAlias}
                                  onChange={(e) => setCustomAlias(e.target.value)}
                                  disabled={!isPremium}
                                  className={`bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-500 py-6 pl-4 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg font-mono ${
                                    !isPremium && "opacity-50 cursor-not-allowed bg-neutral-900"
                                  }`}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-semibold text-neutral-300 block mb-2">Obfuscation Mode</Label>
                                <div className="grid grid-cols-2 gap-4">
                                  <div
                                    onClick={() => setRedirectType("secure")}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                                      redirectType === "secure"
                                        ? "border-indigo-500 bg-indigo-500/10"
                                        : "border-neutral-800 bg-neutral-950/50 hover:border-neutral-700"
                                    }`}
                                  >
                                    <span className="font-bold text-sm text-neutral-200">Secured Redirection</span>
                                    <span className="text-xs text-neutral-400 mt-1">
                                      Obfuscates the destination URL using Base64 coding. Perfect for clean links.
                                    </span>
                                  </div>
                                  <div
                                    onClick={() => setRedirectType("clean")}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                                      redirectType === "clean"
                                        ? "border-indigo-500 bg-indigo-500/10"
                                        : "border-neutral-800 bg-neutral-950/50 hover:border-neutral-700"
                                    }`}
                                  >
                                    <span className="font-bold text-sm text-neutral-200">Clean URL Redirect</span>
                                    <span className="text-xs text-neutral-400 mt-1">
                                      Leaves the target URL readable in the path. Simple and standard.
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-lg font-bold transition-all duration-300 shadow-lg shadow-indigo-600/20"
                              >
                                Generate Redirection Link
                              </Button>
                            </form>
                          </TabsContent>

                          {/* UTM Builder Form */}
                          <TabsContent value="utm" className="mt-0">
                            <form onSubmit={handleGenerateUtm} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="utm-target" className="text-sm font-semibold text-neutral-300">
                                  Website URL
                                </Label>
                                <Input
                                  id="utm-target"
                                  placeholder="e.g. https://mywebsite.com"
                                  value={utmTarget}
                                  onChange={(e) => setUtmTarget(e.target.value)}
                                  className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-500 py-6 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="utm-alias" className="text-sm font-semibold text-neutral-300 flex items-center justify-between">
                                  <span>Custom UTM Alias (Optional)</span>
                                  {!isPremium && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                                      PREMIUM
                                    </span>
                                  )}
                                </Label>
                                <Input
                                  id="utm-alias"
                                  placeholder={isPremium ? "e.g. news-slug" : "Upgrade to Premium to unlock Custom Alias"}
                                  value={utmAlias}
                                  onChange={(e) => setUtmAlias(e.target.value)}
                                  disabled={!isPremium}
                                  className={`bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-500 py-6 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg font-mono ${
                                    !isPremium && "opacity-50 cursor-not-allowed bg-neutral-900"
                                  }`}
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label htmlFor="utm-source" className="text-xs font-semibold text-neutral-400">
                                    Campaign Source (e.g. google, facebook)
                                  </Label>
                                  <Input
                                    id="utm-source"
                                    placeholder="google"
                                    value={utmSource}
                                    onChange={(e) => setUtmSource(e.target.value)}
                                    className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-600 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="utm-medium" className="text-xs font-semibold text-neutral-400">
                                    Campaign Medium (e.g. cpc, email, post)
                                  </Label>
                                  <Input
                                    id="utm-medium"
                                    placeholder="cpc"
                                    value={utmMedium}
                                    onChange={(e) => setUtmMedium(e.target.value)}
                                    className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-600 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="utm-campaign" className="text-xs font-semibold text-neutral-400">
                                    Campaign Name (e.g. summer_sale)
                                  </Label>
                                  <Input
                                    id="utm-campaign"
                                    placeholder="summer_sale"
                                    value={utmCampaign}
                                    onChange={(e) => setUtmCampaign(e.target.value)}
                                    className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-600 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="utm-content" className="text-xs font-semibold text-neutral-400">
                                    Campaign Content (e.g. logolink, textad)
                                  </Label>
                                  <Input
                                    id="utm-content"
                                    placeholder="banner_ad"
                                    value={utmContent}
                                    onChange={(e) => setUtmContent(e.target.value)}
                                    className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-600 rounded-lg"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="utm-term" className="text-xs font-semibold text-neutral-400">
                                  Campaign Term (Optional - keywords)
                                </Label>
                                <Input
                                  id="utm-term"
                                  placeholder="marketing+strategy"
                                  value={utmTerm}
                                  onChange={(e) => setUtmTerm(e.target.value)}
                                  className="bg-neutral-950/80 border-neutral-800 text-white placeholder-neutral-600 rounded-lg"
                                />
                              </div>

                              <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-lg font-bold transition-all duration-300 shadow-lg shadow-indigo-600/20"
                              >
                                Generate Obfuscated UTM Link
                              </Button>
                            </form>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Output / QR Code Side */}
                  <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-xl shadow-2xl h-full flex flex-col justify-between overflow-hidden">
                      <CardHeader className="border-b border-neutral-800 bg-neutral-900/40 pb-4">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-indigo-300">
                          <QrCode className="w-5 h-5 text-indigo-500" /> Result & Sharing
                        </CardTitle>
                        <CardDescription className="text-neutral-400">
                          Copy your link, scan the QR code, or test the output.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-8 flex-grow flex flex-col justify-center items-center">
                        {activeLink ? (
                          <div className="w-full space-y-6 flex flex-col items-center">
                            {/* QR Code Container */}
                            <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center transform hover:scale-[1.02] transition-transform duration-300 relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                                  activeLink
                                )}`}
                                alt="Generated Link QR Code"
                                className="w-48 h-48 md:w-56 md:h-56"
                              />
                            </div>

                            <div className="w-full space-y-3">
                              <Label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                                Generated Link URL
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  readOnly
                                  value={activeLink}
                                  className="bg-neutral-950 border-neutral-800 text-indigo-300 font-mono text-sm py-5 rounded-lg select-all"
                                />
                                <Button
                                  onClick={() => copyToClipboard(activeLink)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-auto rounded-lg"
                                >
                                  {copiedLink ? <Check className="w-5 h-5 text-green-300" /> : <Copy className="w-5 h-5" />}
                                </Button>
                              </div>
                            </div>

                            {/* Action Row */}
                            <div className="grid grid-cols-2 gap-3 w-full">
                              <Button
                                onClick={() => window.open(activeLink, "_blank")}
                                variant="outline"
                                className="border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white py-5 rounded-lg font-medium flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <ExternalLink className="w-4 h-4" /> Test Link
                              </Button>
                              <Button
                                onClick={() => downloadQrCode(activeLink, "gaur_link_qr.png")}
                                variant="outline"
                                className="border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white py-5 rounded-lg font-medium flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Download className="w-4 h-4" /> Download QR
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-16 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-600">
                              <Link2 className="w-8 h-8" />
                            </div>
                            <div className="max-w-xs mx-auto">
                              <h4 className="font-bold text-neutral-300 mb-1">No Active Link</h4>
                              <p className="text-neutral-500 text-sm">
                                Fill in the workspace details on the left and submit to generate a redirect URL.
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* History Section */}
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-neutral-200">
                      <History className="w-6 h-6 text-indigo-500" /> Recently Generated Links
                    </h2>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      {history.length > 0 && (
                        <button
                          onClick={exportToCsv}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export History CSV
                          {!isPremium && <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40" />}
                        </button>
                      )}
                      {history.length > 0 && (
                        <Button
                          onClick={clearHistory}
                          variant="ghost"
                          className="text-neutral-500 hover:text-red-400 flex items-center gap-1.5 p-0 bg-transparent hover:bg-transparent cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Clear All History
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isPremium && history.length >= 5 && (
                    <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 text-center space-y-2">
                      <p className="text-sm text-neutral-400">You have reached the **5-link history cap** for the free tier.</p>
                      <button
                        onClick={() => setGateTab("checkout")}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Upgrade to Premium to unlock Custom Aliases, CSV export, &
                        unlimited logs!
                      </button>
                    </div>
                  )}

                  <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-xl shadow-2xl">
                    <CardContent className="p-6 space-y-4">
                      {/* Search and Filters */}
                      {history.length > 0 && (
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                          <Input
                            placeholder="Search your generated links history..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-neutral-950 border-neutral-800 text-white pl-10 py-5 rounded-lg placeholder-neutral-500 focus:ring-indigo-500"
                          />
                        </div>
                      )}

                      {filteredHistory.length > 0 ? (
                        <div className="divide-y divide-neutral-800/80">
                          {filteredHistory.map((item) => (
                            <div
                              key={item.id}
                              className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                            >
                              <div className="space-y-1.5 max-w-xl">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      item.type === "utm" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                                    }`}
                                  >
                                    {item.type.toUpperCase()}
                                  </span>
                                  <span className="text-neutral-500 text-xs">{item.createdAt}</span>
                                </div>
                                <h4 className="font-bold text-neutral-200 text-sm md:text-base truncate">{item.title}</h4>
                                <div className="flex flex-col gap-1">
                                  <p className="text-neutral-400 text-xs font-mono truncate max-w-lg">
                                    <span className="text-neutral-500 font-sans">Destination:</span> {item.originalUrl}
                                  </p>
                                  <p className="text-indigo-400 text-xs font-mono truncate max-w-lg">
                                    <span className="text-neutral-500 font-sans">Redirect Link:</span> {item.generatedUrl}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                <Button
                                  onClick={() => copyToClipboard(item.generatedUrl)}
                                  variant="outline"
                                  size="sm"
                                  className="border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                                </Button>
                                <Button
                                  onClick={() => window.open(item.generatedUrl, "_blank")}
                                  variant="outline"
                                  size="sm"
                                  className="border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Visit
                                </Button>
                                <Button
                                  onClick={() => downloadQrCode(item.generatedUrl, "qr_code.png")}
                                  variant="outline"
                                  size="sm"
                                  className="border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                                  title="Download QR Code"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  onClick={() => deleteHistoryItem(item.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-neutral-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 space-y-3">
                          <div className="w-12 h-12 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-600">
                            <History className="w-6 h-6" />
                          </div>
                          <div className="max-w-xs mx-auto">
                            <h4 className="font-bold text-neutral-400 mb-1">No Links Found</h4>
                            <p className="text-neutral-500 text-sm">
                              {searchQuery
                                ? "No history matches your search filter."
                                : "Generated links will appear in your history list automatically."}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}

export { AuthHome as default } from "@/components/auth-home"
