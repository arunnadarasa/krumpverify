import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { VerifyForm } from './VerifyForm'
import { RegisterIPForm } from './RegisterIPForm'
import { MintNFTForm } from './MintNFTForm'

export default function App() {
  const [activeTab, setActiveTab] = useState<'mint' | 'register' | 'verify'>('mint')
  const [registeredIpId, setRegisteredIpId] = useState<string | null>(null)
  const [mintedNft, setMintedNft] = useState<{ contract: string; tokenId: string } | null>(null)

  const handleMintSuccess = (contract: string, tokenId: string) => {
    setMintedNft({ contract, tokenId })
    setActiveTab('register')
  }

  const handleRegisterSuccess = (ipId: string) => {
    setRegisteredIpId(ipId)
    setActiveTab('verify')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-amber-400/90">Krump Verify</span>
            <span className="text-xs text-gray-500">StreetKode Fam · Story Aeneid</span>
          </div>
          <ConnectButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white/95 mb-2">
            Verify your move on-chain
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            Connect your wallet on Story Aeneid. Mint an NFT, register it as IP, then verify moves.
          </p>
        </div>
        <nav className="max-w-lg mx-auto flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setActiveTab('mint')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'mint'
                ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Mint NFT
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'register'
                ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Register IP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'verify'
                ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Verify move
          </button>
        </nav>
        {activeTab === 'mint' && <MintNFTForm onMintSuccess={handleMintSuccess} />}
        {activeTab === 'register' && (
          <RegisterIPForm
            onRegisterSuccess={handleRegisterSuccess}
            initialNft={mintedNft ?? undefined}
          />
        )}
        {activeTab === 'verify' && <VerifyForm initialIpId={registeredIpId ?? undefined} />}
        <footer className="max-w-lg mx-auto mt-12 text-center text-xs text-gray-500">
          <a
            href="https://asura.lovable.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500/80 hover:underline"
          >
            Asura
          </a>
          {' · '}
          <a
            href="https://aeneid.storyscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500/80 hover:underline"
          >
            Explorer
          </a>
        </footer>
      </main>
    </div>
  )
}
