import { Share, Linking } from 'react-native'
import * as Sharing from 'expo-sharing'
import * as Clipboard from 'expo-clipboard'

export interface ShareData {
  reviewId: string
  reviewerName: string
  verdictEmoji: string
  verdictLabel: string
  businessName: string
  category?: string
  area?: string
  text?: string
}

export function buildCaption(d: ShareData): string {
  const bizLine = [d.businessName, d.category, d.area].filter(Boolean).join(' · ')
  const lines = [
    `${d.reviewerName} · Reviewencer`,
    '',
    `${d.verdictEmoji} ${d.verdictLabel}`,
    '',
    bizLine,
  ]
  if (d.text) lines.push(`"${d.text}"`)
  lines.push(
    '',
    `https://reviewencer.com/r/${d.reviewId}`,
  )
  return lines.join('\n')
}

export async function shareVideoToWhatsApp(videoUri: string, data: ShareData) {
  const caption = buildCaption(data)
  await Clipboard.setStringAsync(caption)
  const isAvailable = await Sharing.isAvailableAsync()
  if (isAvailable) {
    await Sharing.shareAsync(videoUri, { mimeType: 'video/mp4', UTI: 'public.movie' })
  } else {
    const url = `whatsapp://send?text=${encodeURIComponent(caption)}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) await Linking.openURL(url)
    else await Share.share({ message: caption })
  }
}

export async function shareNative(data: ShareData) {
  const caption = buildCaption(data)
  await Clipboard.setStringAsync(caption)
  await Share.share({ message: caption, title: 'Share your review' })
}
