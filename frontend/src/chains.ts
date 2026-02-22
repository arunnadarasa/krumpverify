import { defineChain } from 'viem'

export const storyAeneid = defineChain({
  id: 1315,
  name: 'Story Aeneid',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_RPC_URL || 'https://aeneid.storyrpc.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'StoryScan',
      url: import.meta.env.VITE_EXPLORER_URL || 'https://aeneid.storyscan.io',
    },
  },
})
