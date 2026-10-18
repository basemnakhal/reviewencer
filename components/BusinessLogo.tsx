import { useState } from 'react'
import { Image, Text } from 'react-native'

type Props = { name: string; logoUrl?: string | null; size?: number }

function deriveDomain(name: string) {
  return name.toLowerCase().split(/[\s,|()\-&]/)[0].replace(/[^a-z0-9]/g, '') + '.com'
}

export function BusinessLogo({ name, logoUrl, size = 32 }: Props) {
  const [state, setState] = useState<'favicon' | 'stored' | 'fallback'>('favicon')

  const imgStyle = { width: size, height: size, borderRadius: size * 0.2 }

  if (state === 'favicon') {
    return (
      <Image
        source={{ uri: `https://www.google.com/s2/favicons?domain=${deriveDomain(name)}&sz=256` }}
        style={imgStyle}
        onError={() => setState('stored')}
      />
    )
  }

  if (state === 'stored' && logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={imgStyle}
        onError={() => setState('fallback')}
      />
    )
  }

  return <Text style={{ fontSize: size * 0.85 }}>🏢</Text>
}
