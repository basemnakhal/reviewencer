import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Line, Path, Polygon, Polyline } from 'react-native-svg'
import { useLanguage } from '../lib/i18n'

export type ReviewCardProps = {
  id: string
  rating: number
  text?: string
  video_url?: string
  transcript?: string
  ai_likes_en?: string[]
  ai_nopes_en?: string[]
  legit_count: number
  view_count: number
  share_count: number
  tags?: string[]
  author: {
    display_name: string
    handle: string
    avatar_url?: string
    avatar_color?: string
    tier: 'reviewer' | 'top_reviewer' | 'reviewencer'
  }
  business: {
    name: string
    slug: string
    logo_url: string | null
  }
  onLegit?: (id: string) => void
  isLegitByMe?: boolean
  onPress?: () => void
}

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F0A500',
  '#DDA0DD', '#00B894', '#F7DC6F', '#6C5CE7', '#85C1E9',
  '#E17055', '#74B9FF', '#A29BFE', '#55EFC4', '#FD79A8',
]

function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function fmtCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

function EyeIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  )
}

function ShieldIcon({ active }: { active: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={active ? '#7B2CFF' : '#555'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Polyline points="9 12 11 14 15 10" />
    </Svg>
  )
}

function ShareIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={18} cy={5} r={3} />
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={19} r={3} />
      <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
      <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
    </Svg>
  )
}

function PlayIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24">
      <Polygon points="5 3 19 12 5 21 5 3" fill="rgba(255,255,255,0.9)" />
    </Svg>
  )
}

function ThumbUpIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </Svg>
  )
}

function ThumbMehIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={8} y1={15} x2={16} y2={15} />
      <Line x1={9} y1={9} x2={9.01} y2={9} strokeWidth={3} />
      <Line x1={15} y1={9} x2={15.01} y2={9} strokeWidth={3} />
    </Svg>
  )
}

function ThumbDownIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <Path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </Svg>
  )
}

const VERDICT = {
  5: { bg: '#dcfce7', color: '#15803d' },
  3: { bg: '#fef9c3', color: '#a16207' },
  1: { bg: '#fee2e2', color: '#b91c1c' },
}

export default function ReviewCard({
  id, rating, text, video_url, legit_count, view_count, share_count,
  tags, author, business, onLegit, isLegitByMe = false, onPress,
}: ReviewCardProps) {
  const { t } = useLanguage()
  const [legitActive, setLegitActive] = useState(isLegitByMe)
  const [localLegitCount, setLocalLegitCount] = useState(legit_count)

  if (!author) return null
  const avatarColor = author.avatar_color ?? hashColor(author.handle)
  const verdict = VERDICT[rating as 5 | 3 | 1] ?? VERDICT[3]

  function handleLegit() {
    const next = !legitActive
    setLegitActive(next)
    setLocalLegitCount(c => next ? c + 1 : c - 1)
    onLegit?.(id)
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.85 : 1}>

      {/* Header */}
      <View style={styles.header}>
        {author.avatar_url ? (
          <Image source={{ uri: author.avatar_url }} style={[styles.avatar, { borderColor: avatarColor }]} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials(author.display_name)}</Text>
          </View>
        )}

        <View style={styles.nameCol}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{author.display_name}</Text>
            {author.tier === 'top_reviewer' && (
              <View style={[styles.tierPill, { backgroundColor: avatarColor }]}>
                <Text style={styles.tierText}>{t('tierTopReviewer')}</Text>
              </View>
            )}
            {author.tier === 'reviewencer' && (
              <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tierPill}>
                <Text style={styles.tierText}>{t('tierReviewencer')}</Text>
              </LinearGradient>
            )}
          </View>
          <Text style={styles.handle}>@{author.handle}</Text>
        </View>

        <View style={[styles.verdictCircle, { backgroundColor: verdict.bg }]}>
          {rating === 5 ? <ThumbUpIcon color={verdict.color} /> :
           rating === 1 ? <ThumbDownIcon color={verdict.color} /> :
           <ThumbMehIcon color={verdict.color} />}
        </View>
      </View>

      {/* Video thumbnail */}
      {!!video_url && (
        <View style={styles.videoThumb}>
          <LinearGradient colors={['#1a1a2e', '#0f3460']} style={StyleSheet.absoluteFill} />
          <PlayIcon />
          <View style={styles.bizTag}>
            <Text style={styles.bizTagText}>{business.name}</Text>
          </View>
          {legit_count >= 10 && (
            <View style={styles.trustedStamp}>
              <Text style={styles.trustedText}>{t('trusted')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Caption */}
      {!!text && (
        <Text style={styles.caption} numberOfLines={3}>{text}</Text>
      )}

      {/* Hashtags */}
      {!!tags?.length && (
        <Text style={styles.tags}>{tags.map(t => `#${t}`).join('  ')}</Text>
      )}

      {/* Metrics */}
      <View style={styles.metrics}>
        <View style={styles.metricItem}>
          <EyeIcon />
          <Text style={styles.metricText}>{fmtCount(view_count)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.legitBtn, legitActive && styles.legitBtnActive]}
          onPress={handleLegit}
          activeOpacity={0.7}
        >
          <ShieldIcon active={legitActive} />
          <Text style={[styles.metricText, legitActive && styles.legitTextActive]}>
            {fmtCount(localLegitCount)} {t('legitBtn')}
          </Text>
        </TouchableOpacity>

        <View style={styles.metricItem}>
          <ShareIcon />
          <Text style={styles.metricText}>{fmtCount(share_count)}</Text>
        </View>
      </View>

    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2a3a',
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  nameCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  displayName: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  handle: { color: '#555', fontSize: 11, marginTop: 2 },
  tierPill: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
  tierText: { color: '#fff', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  verdictCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  videoThumb: { height: 200, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bizTag: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  bizTagText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  trustedStamp: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e',
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  trustedText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  caption: { color: '#ccc', fontSize: 13, lineHeight: 20, paddingHorizontal: 12, paddingTop: 10 },
  tags: { color: '#2B8BFF', fontSize: 12, paddingHorizontal: 12, paddingTop: 6, lineHeight: 20 },
  metrics: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 14,
  },
  metricItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { color: '#555', fontSize: 12 },
  legitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#1e2a3a',
  },
  legitBtnActive: { borderColor: '#7B2CFF', backgroundColor: '#1a1040' },
  legitTextActive: { color: '#7B2CFF' },
})
