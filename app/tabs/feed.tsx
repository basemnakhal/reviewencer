import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  ActivityIndicator, Dimensions, FlatList, Image,
  RefreshControl, StatusBar, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native'
import Svg, { Circle, Line, Path, Polygon, Polyline } from 'react-native-svg'
import { TierBadge } from '../../components/TierBadge'
import { type Category, getCategoryLabel } from '../../lib/categories'
import { useLanguage } from '../../lib/i18n'
import { shareNative } from '../../lib/share'
import { supabase } from '../../lib/supabase'

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window')

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F0A500',
  '#DDA0DD', '#00B894', '#F7DC6F', '#6C5CE7', '#85C1E9',
]
function hashColor(s: string) {
  let h = 0
  for (const c of s) { h = c.charCodeAt(0) + ((h << 5) - h); h |= 0 }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}
function fmtCount(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

type Review = {
  id: string
  author_id: string
  rating: number
  text: string
  transcript_ar: string | null
  video_url: string
  legit_count: number
  view_count: number
  share_count: number
  tags: string[]
  business: { name: string; slug: string; logo_url: string | null; category: Category | null }
  author: { display_name: string; handle: string; avatar_url: string; tier: string }
}

function ShieldIcon({ active }: { active: boolean }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#7B2CFF' : '#fff'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Polyline points="9 12 11 14 15 10" />
    </Svg>
  )
}
function ShareIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none"
      stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={18} cy={5} r={3} /><Circle cx={6} cy={12} r={3} /><Circle cx={18} cy={19} r={3} />
      <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
      <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
    </Svg>
  )
}
function InfoIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none"
      stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={12} y1={16} x2={12} y2={12} />
      <Line x1={12} y1={8} x2={12.01} y2={8} strokeWidth={3} />
    </Svg>
  )
}
function EyeIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.75)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  )
}
function LinkIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  )
}

const VERDICT = {
  5: { labelKey: 'verdictLovedIt' as const, color: '#22c55e', emoji: '👍' },
  3: { labelKey: 'verdictOkay'    as const, color: '#eab308', emoji: '😐' },
  1: { labelKey: 'verdictNope'    as const, color: '#ef4444', emoji: '👎' },
}

function VerdictIcon({ rating, color }: { rating: number; color: string }) {
  if (rating === 5) return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </Svg>
  )
  if (rating === 1) return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <Path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </Svg>
  )
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={8} y1={15} x2={16} y2={15} />
      <Line x1={9} y1={9} x2={9.01} y2={9} strokeWidth={3} />
      <Line x1={15} y1={9} x2={15.01} y2={9} strokeWidth={3} />
    </Svg>
  )
}

function FeedItem({
  item, isActive, isFocused, onLegit, isLegitByMe, isSelf, height,
}: {
  item: Review; isActive: boolean; isFocused: boolean; onLegit: (id: string) => void; isLegitByMe: boolean; isSelf: boolean; height: number
}) {
  const { t, lang } = useLanguage()
  const player = useVideoPlayer(item.video_url ?? null, p => {
    p.loop = true
    p.muted = false
  })
  const [legitActive, setLegitActive] = useState(isLegitByMe)
  const [localLegitCount, setLocalLegitCount] = useState(item.legit_count)

  useEffect(() => {
    if (!item.video_url) return
    if (isActive && isFocused) player.play()
    else player.pause()
  }, [isActive, isFocused, player])

  async function handleShare() {
    const verdict = VERDICT[item.rating as 5 | 3 | 1] ?? VERDICT[3]
    await shareNative({
      reviewId: item.id,
      reviewerName: item.author?.display_name ?? 'Anonymous',
      verdictEmoji: verdict.emoji,
      verdictLabel: t(verdict.labelKey),
      businessName: item.business.name,
      category: getCategoryLabel(item.business.category, lang),
    })
  }

  function handleLegit() {
    if (isSelf) return
    const next = !legitActive
    setLegitActive(next)
    setLocalLegitCount(c => Math.max(0, c + (next ? 1 : -1)))
    onLegit(item.id)
  }

  const verdict = VERDICT[item.rating as 5 | 3 | 1] ?? VERDICT[3]
  const verdictLabel = t(verdict.labelKey)
  const avatarColor = hashColor(item.author?.handle ?? 'x')

  // two colors derived from business name for a unique gradient per review
  const c1 = hashColor(item.business.name)
  const c2 = hashColor(item.business.name + '2')

  return (
    <View style={[s.item, { height }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Video background */}
      {item.video_url ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
        />
      ) : (
        <LinearGradient
          colors={[c1, c2, '#0D1117']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* dark gradient at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
        locations={[0.3, 0.6, 1]}
        style={[StyleSheet.absoluteFill, { top: '30%' }]}
      />
      {/* slight dark at top */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={[StyleSheet.absoluteFill, { bottom: '80%' }]}
      />

      {/* Top: business + verdict */}
      <View style={s.topBar}>
        <View style={s.bizPill}>
          {item.business.logo_url
            ? <Image source={{ uri: item.business.logo_url }} style={{ width: 20, height: 20, borderRadius: 4 }} />
            : <Text style={s.bizEmoji}>🏢</Text>
          }
          <Text style={s.bizName} numberOfLines={1}>{item.business.name}</Text>
        </View>
        <View style={[s.verdictPill, { borderColor: verdict.color }]}>
          <VerdictIcon rating={item.rating} color={verdict.color} />
          <Text style={[s.verdictText, { color: verdict.color }]}>{verdictLabel}</Text>
        </View>
      </View>

      {/* Bottom row: left info + right actions */}
      <View style={s.bottomRow}>
        {/* Left: author + caption — TikTok/Instagram share card layout */}
        <View style={s.leftCol}>
          {/* "Name · Reviewencer 🎬" */}
          <TouchableOpacity style={s.authorRow} activeOpacity={0.8}>
            {item.author?.avatar_url ? (
              <Image source={{ uri: item.author.avatar_url }} style={[s.avatar, { borderColor: avatarColor }]} />
            ) : (
              <View style={[s.avatar, { backgroundColor: avatarColor }]}>
                <Text style={s.avatarText}>{initials(item.author?.display_name ?? '?')}</Text>
              </View>
            )}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={s.displayName}>{item.author?.display_name}</Text>
                {item.author?.tier && item.author.tier !== 'reviewer' && (
                  <TierBadge tier={item.author.tier as any} variant="dark" />
                )}
              </View>
              <Text style={s.handle}>@{item.author?.handle}</Text>
            </View>
          </TouchableOpacity>

          {/* Business · Category */}
          <Text style={s.captionLine} numberOfLines={1}>
            <Text style={s.captionBiz}>{item.business.name}</Text>
            {item.business.category
              ? <Text style={s.captionMeta}> · {getCategoryLabel(item.business.category, lang)}</Text>
              : null}
          </Text>

          {/* Optional review text — use Arabic transcript when available */}
          {!!(lang === 'ar' && item.transcript_ar ? item.transcript_ar : item.text) && (
            <Text style={s.caption} numberOfLines={2}>
              "{lang === 'ar' && item.transcript_ar ? item.transcript_ar : item.text}"
            </Text>
          )}

        </View>

        {/* Right: action buttons */}
        <View style={s.rightCol}>
          <View style={s.actionBtn}>
            <EyeIcon size={22} />
            <Text style={s.actionLabel}>{fmtCount(item.view_count)}</Text>
          </View>
          <TouchableOpacity style={s.actionBtn} onPress={handleLegit} activeOpacity={isSelf ? 1 : 0.7} disabled={isSelf}>
            <View style={[s.actionCircle, legitActive && s.actionCircleActive, isSelf && { opacity: 0.3 }]}>
              <ShieldIcon active={legitActive} />
            </View>
            <Text style={[s.actionLabel, legitActive && { color: '#7B2CFF' }]}>
              {fmtCount(localLegitCount)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <View style={s.actionCircle}>
              <ShareIcon />
            </View>
            <Text style={s.actionLabel}>{fmtCount(item.share_count)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push({ pathname: '/review-detail', params: { reviewId: item.id } })}
            activeOpacity={0.7}
          >
            <View style={s.actionCircle}>
              <InfoIcon />
            </View>
            <Text style={s.actionLabel}>{t('more')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default function FeedScreen() {
  const { t, contentLang } = useLanguage()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [itemHeight, setItemHeight] = useState(SCREEN_H)
  const [isFocused, setIsFocused] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const legitByMe = useRef(new Set<string>())

  useFocusEffect(useCallback(() => {
    setIsFocused(true)
    return () => setIsFocused(false)
  }, []))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
    })
  }, [])

  useEffect(() => { fetchFeed() }, [contentLang])

  async function fetchFeed(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    let query = supabase
      .from('reviews')
      .select(`
        id, author_id, rating, text, transcript_ar, video_url, legit_count, view_count, share_count, tags,
        business:businesses(name:name_en, slug, logo_url, category:categories(name_en, name_ar)),
        author:profiles(display_name, handle, avatar_url, tier)
      `)
      .eq('moderation_status', 'published')
      .order('published_at', { ascending: false })
      .limit(30)

    if (contentLang !== 'both') query = query.eq('language', contentLang)

    const { data, error } = await query
    if (!error && data) {
      const filtered = (data as any).filter((r: any) => r.author !== null)
      // Load which reviews current user has already voted on
      const { data: session } = await supabase.auth.getSession()
      const uid = session.session?.user.id
      if (uid && filtered.length > 0) {
        const ids = filtered.map((r: any) => r.id)
        const { data: votes } = await supabase
          .from('legit_votes')
          .select('review_id')
          .eq('voter_user_id', uid)
          .in('review_id', ids)
        if (votes) legitByMe.current = new Set(votes.map((v: any) => v.review_id))
      }
      setReviews(filtered)
    }
    setLoading(false)
    setRefreshing(false)
  }

  const onRefresh = useCallback(() => fetchFeed(true), [contentLang])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0)
  }).current

  async function handleLegit(id: string) {
    const uid = userId
    if (!uid) return
    const wasLegit = legitByMe.current.has(id)
    if (wasLegit) {
      legitByMe.current.delete(id)
      await supabase.from('legit_votes').delete()
        .eq('review_id', id).eq('voter_user_id', uid)
    } else {
      legitByMe.current.add(id)
      await supabase.from('legit_votes').insert({ review_id: id, voter_user_id: uid })
    }
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color="#2B8BFF" size="large" />
    </View>
  )

  if (reviews.length === 0) return (
    <View style={s.center}>
      <Text style={{ fontSize: 48 }}>🎬</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>{t('noReviews')}</Text>
      <Text style={{ color: '#555', fontSize: 14, marginTop: 4 }}>{t('noReviewsSub')}</Text>
    </View>
  )

  return (
    <FlatList
      data={reviews}
      keyExtractor={r => r.id}
      onLayout={e => setItemHeight(e.nativeEvent.layout.height)}
      renderItem={({ item, index }) => (
        <FeedItem
          item={item}
          isActive={index === activeIndex}
          isFocused={isFocused}
          onLegit={handleLegit}
          isLegitByMe={legitByMe.current.has(item.id)}
          isSelf={userId !== null && item.author_id === userId}
          height={itemHeight}
        />
      )}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
      windowSize={3}
      maxToRenderPerBatch={2}
      initialNumToRender={2}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2B8BFF" colors={['#2B8BFF']} />
      }
      style={{ backgroundColor: '#000' }}
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0D1117', alignItems: 'center', justifyContent: 'center' },
  item: { width: SCREEN_W, height: SCREEN_H, backgroundColor: '#0D1117' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  topBar: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, gap: 10,
  },
  bizPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, flex: 1,
  },
  bizEmoji: { fontSize: 16 },
  bizName: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  verdictPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  verdictText: { fontSize: 12, fontWeight: '700' },
  bottomRow: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, gap: 12,
  },
  leftCol: { flex: 1, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  displayName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  brandSuffix: { color: '#FF7A00', fontSize: 13, fontWeight: '600' },
  handle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  engagementCount: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  engagementDot: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  sourceLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  captionLine: { color: '#fff', fontSize: 13 },
  captionBiz: { fontWeight: '700' },
  captionMeta: { color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
  caption: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  sourceLink: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  rightCol: { gap: 20, paddingBottom: 4 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionCircleActive: { backgroundColor: 'rgba(123,44,255,0.25)' },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
})
