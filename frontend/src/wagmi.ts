import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { storyAeneid } from './chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'be37b17af0fbb579190219af99593a24'

export const config = getDefaultConfig({
  appName: 'Krump Verify',
  projectId,
  chains: [storyAeneid],
  ssr: false,
})
