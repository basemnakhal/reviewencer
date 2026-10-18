import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { VideoView, useVideoPlayer } from 'expo-video'

let Head: React.ComponentType<{ children: React.ReactNode }> | null = null
if (Platform.OS === 'web') {
  Head = require('expo-router/head').Head
}
import { ChevronLeft, Share2 } from 'lucide-react-native'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Platform, SafeAreaView, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { BusinessLogo } from '../components/BusinessLogo'
import { type Category, getCategoryLabel } from '../lib/categories'
import { useLanguage } from '../lib/i18n'
import { shareNative } from '../lib/share'
import { supabase } from '../lib/supabase'
import { type Lang } from '../lib/translations'

type Review = {
  id: string
  rating: number
  text: string
  transcript_en: string
  transcript_ar: string
  ai_likes_en: string[]
  ai_likes_ar: string[]
  ai_nopes_en: string[]
  ai_nopes_ar: string[]
  video_url: string
  thumbnail_url: string | null
  view_count: number
  legit_count: number
  business: { id: string; name: string; logo_url: string | null; slug: string; category: Category | null }
  author: { display_name: string; handle: string }
}

function VideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, p => {
    p.loop = true
    p.play()
  })
  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="cover"
      nativeControls
    />
  )
}

function ThumbIcon({ rating }: { rating: number }) {
  if (rating === 5) return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
      <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </Svg>
  )
  if (rating === 1) return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
      <Path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
    </Svg>
  )
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10}/>
      <Line x1={8} y1={15} x2={16} y2={15}/>
      <Line x1={9} y1={9} x2={9.01} y2={9} strokeWidth={3}/>
      <Line x1={15} y1={9} x2={15.01} y2={9} strokeWidth={3}/>
    </Svg>
  )
}

export default function ReviewDetailScreen() {
  const { t, lang: appLang, isRTL } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const params = useLocalSearchParams()
  const reviewId = params.reviewId as string
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [langOverride, setLangOverride] = useState<Lang | null>(null)
  const detailLang = langOverride ?? appLang

  useEffect(() => { fetchReview() }, [reviewId])

  async function fetchReview() {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id, rating, text, transcript_en, transcript_ar, ai_likes_en, ai_likes_ar, ai_nopes_en, ai_nopes_ar, video_url, thumbnail_url, view_count, legit_count,
        business:businesses(id, name:name_en, logo_url, slug, category:categories(name_en, name_ar)),
        author:profiles(display_name, handle)
      `)
      .eq('id', reviewId)
      .single()

    if (!error && data) setReview(data as any)
    setLoading(false)
  }

  async function shareReview() {
    if (!review) return
    await shareNative({
      reviewId: review.id,
      reviewerName: review.author?.display_name ?? review.author?.handle ?? 'Anonymous',
      verdictEmoji: verdictEmoji,
      verdictLabel: verdictLabel,
      businessName: review.business.name,
      category: getCategoryLabel(review.business.category, appLang),
      text: review.text || undefined,
    })
  }

  const verdictColor = review?.rating === 5 ? '#22c55e' : review?.rating === 1 ? '#ef4444' : '#eab308'
  const verdictLabel = review?.rating === 5 ? t('verdictLovedIt') : review?.rating === 1 ? t('verdictNope') : t('verdictOkay')
  const verdictEmoji = review?.rating === 5 ? '👍' : review?.rating === 1 ? '👎' : '😐'

  const ogUrl = review ? `https://reviewencer.com/business/${review.business.slug}/review/${review.id}` : ''
  const ogTitle = review ? `${review.author?.display_name ?? review.author?.handle ?? 'Someone'} on Reviewencer 🎬` : 'Reviewencer'
  const ogDescription = review
    ? `${verdictEmoji} ${verdictLabel} · ${review.business.name}\n${review.view_count ?? 0} views · ${review.legit_count ?? 0} Legit`
    : ''
  const ogImage = review?.thumbnail_url ?? 'https://reviewencer.com/og-image.png'
  const hasAiContent = (review?.ai_likes_en?.length ?? 0) > 0 || (review?.ai_nopes_en?.length ?? 0) > 0
  const hasAr = (review?.ai_likes_ar?.length ?? 0) > 0 || (review?.ai_nopes_ar?.length ?? 0) > 0
  const aiLikes = detailLang === 'ar' ? review?.ai_likes_ar : review?.ai_likes_en
  const aiNopes = detailLang === 'ar' ? review?.ai_nopes_ar : review?.ai_nopes_en
  const isContentAr = detailLang === 'ar'

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color="#2B8BFF" size="large" style={{ marginTop: 40 }} />
    </SafeAreaView>
  )

  if (!review) return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.errorText}>{t('reviewNotFound')}</Text>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.container}>
      {review && Head && (
        <Head>
          <title>{ogTitle}</title>
          <meta property="og:title" content={ogTitle} />
          <meta property="og:description" content={ogDescription} />
          <meta property="og:url" content={ogUrl} />
          {ogImage ? <meta property="og:image" content={ogImage} /> : null}
          <meta property="og:type" content="article" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={ogTitle} />
          <meta name="twitter:description" content={ogDescription} />
          {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        </Head>
      )}
      <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#fff" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={shareReview}>
          <Share2 color="#fff" size={20} />
          <Text style={styles.shareBtnText}>{t('share')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {review.video_url
          ? <VideoPlayer url={review.video_url} />
          : (
            <View style={styles.noVideo}>
              <Text style={styles.noVideoText}>{t('writtenReview')}</Text>
            </View>
          )
        }

        <View style={[styles.content, rtl]}>
          <View style={[styles.bizRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <BusinessLogo name={review.business.name} logoUrl={review.business.logo_url} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bizName, isRTL && { textAlign: 'right' }]}>{review.business.name}</Text>
              <Text style={[styles.author, isRTL && { textAlign: 'right' }]}>@{review.author?.handle ?? 'anonymous'}</Text>
            </View>
            <View style={[styles.verdictBadge, { backgroundColor: verdictColor }]}>
              <ThumbIcon rating={review.rating} />
              <Text style={styles.verdictText}>{verdictLabel}</Text>
            </View>
          </View>

          {(review.text || review.transcript_ar) ? (
            <Text style={[styles.reviewText, isRTL && { textAlign: 'right', writingDirection: 'rtl' }]}>
              {appLang === 'ar' && review.transcript_ar ? review.transcript_ar : review.text}
            </Text>
          ) : null}

          {hasAiContent && (
            <View style={styles.aiBox}>
              <View style={[styles.aiHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.aiLabel}>{t('aiSummary')}</Text>
                {hasAr && (
                  <View style={styles.langToggle}>
                    <TouchableOpacity
                      style={[styles.langBtn, !isContentAr && styles.langBtnActive]}
                      onPress={() => setLangOverride('en')}
                    >
                      <Text style={[styles.langBtnText, !isContentAr && styles.langBtnTextActive]}>EN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.langBtn, isContentAr && styles.langBtnActive]}
                      onPress={() => setLangOverride('ar')}
                    >
                      <Text style={[styles.langBtnText, isContentAr && styles.langBtnTextActive]}>AR</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {aiLikes && aiLikes.length > 0 && (
                <View style={styles.aiSection}>
                  <Text style={[styles.aiSectionTitle, isContentAr && { textAlign: 'right' }]}>{t('aiLikes')}</Text>
                  {aiLikes.map((item, i) => (
                    <View key={i} style={[styles.aiItem, isContentAr && styles.aiItemRtl]}>
                      <View style={[styles.aiDot, { backgroundColor: '#22c55e' }]} />
                      <Text style={[styles.aiItemText, isContentAr && styles.aiItemTextRtl]}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {aiNopes && aiNopes.length > 0 && (
                <View style={styles.aiSection}>
                  <Text style={[styles.aiSectionTitle, isContentAr && { textAlign: 'right' }]}>{t('aiNopes')}</Text>
                  {aiNopes.map((item, i) => (
                    <View key={i} style={[styles.aiItem, isContentAr && styles.aiItemRtl]}>
                      <View style={[styles.aiDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={[styles.aiItemText, isContentAr && styles.aiItemTextRtl]}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.shareCTA} onPress={shareReview}>
            <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.gradient}>
              <Share2 color="#fff" size={16} />
              <Text style={styles.shareCTAText}>{t('shareThisReview')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn: { padding: 4 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#161b22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  video: { width: '100%', height: 300 },
  noVideo: { height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#161b22' },
  noVideoText: { color: '#666', fontSize: 16 },
  content: { padding: 20 },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  bizName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  author: { color: '#666', fontSize: 12, marginTop: 2 },
  verdictBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  verdictText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reviewText: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  aiBox: { backgroundColor: '#161b22', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#1e2a3a' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  aiLabel: { color: '#7B2CFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  langToggle: { flexDirection: 'row', backgroundColor: '#0D1117', borderRadius: 8, padding: 2, gap: 2 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  langBtnActive: { backgroundColor: '#7B2CFF' },
  langBtnText: { color: '#555', fontSize: 11, fontWeight: '700' },
  langBtnTextActive: { color: '#fff' },
  aiSection: { marginBottom: 12 },
  aiSectionTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  aiItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  aiItemRtl: { flexDirection: 'row-reverse' },
  aiDot: { width: 6, height: 6, borderRadius: 3 },
  aiItemText: { color: '#aaa', fontSize: 13, flex: 1 },
  aiItemTextRtl: { textAlign: 'right', writingDirection: 'rtl' },
  shareCTA: { borderRadius: 24, overflow: 'hidden', marginBottom: 40 },
  gradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  shareCTAText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#666', textAlign: 'center', marginTop: 40 },
})
