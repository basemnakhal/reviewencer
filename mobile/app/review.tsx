import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'

import { Camera, ChevronLeft, PenLine, Share2, ThumbsUp, Upload } from 'lucide-react-native'
import { useState, useEffect } from 'react'
import {
  ActivityIndicator, Alert,
  SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { processReview } from '../lib/ai'
import { BusinessLogo } from '../components/BusinessLogo'
import { useLanguage } from '../lib/i18n'
import { type Category, getCategoryLabel } from '../lib/categories'
import { buildCaption, shareNative, type ShareData } from '../lib/share'
import { supabase } from '../lib/supabase'

type ThumbValue = 1 | 3 | 5

function ThumbUpIcon({ stroke }: { stroke: string }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" stroke={stroke}/>
    <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke={stroke}/>
  </Svg>
}

function ThumbMehIcon({ stroke }: { stroke: string }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={stroke}/>
    <Line x1={8} y1={15} x2={16} y2={15} stroke={stroke}/>
    <Line x1={9} y1={9} x2={9.01} y2={9} stroke={stroke} strokeWidth={3}/>
    <Line x1={15} y1={9} x2={15.01} y2={9} stroke={stroke} strokeWidth={3}/>
  </Svg>
}

function ThumbDownIcon({ stroke }: { stroke: string }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" stroke={stroke}/>
    <Path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" stroke={stroke}/>
  </Svg>
}


export default function ReviewScreen() {
  const { t, isRTL, lang } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const params = useLocalSearchParams()
  const businessName = params.businessName as string
  const businessLogo = params.businessLogo as string
  const businessId = params.businessId as string

  const THUMBS = [
    { v: 5 as ThumbValue, labelKey: 'verdictLovedIt' as const, emoji: '👍', activeBg: '#dcfce7', activeBorder: '#22c55e', activeText: '#15803d', activeCircle: '#22c55e', Icon: ThumbUpIcon },
    { v: 3 as ThumbValue, labelKey: 'verdictOkay' as const,   emoji: '😐', activeBg: '#fef9c3', activeBorder: '#eab308', activeText: '#a16207', activeCircle: '#eab308', Icon: ThumbMehIcon },
    { v: 1 as ThumbValue, labelKey: 'verdictNope' as const,   emoji: '👎', activeBg: '#fee2e2', activeBorder: '#ef4444', activeText: '#b91c1c', activeCircle: '#ef4444', Icon: ThumbDownIcon },
  ]

  const [thumb, setThumb] = useState<ThumbValue | null>(null)
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [textExpanded, setTextExpanded] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [done, setDone] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [bizCategory, setBizCategory] = useState('')
  const [reviewerName, setReviewerName] = useState('You')

  useEffect(() => {
    supabase.from('businesses')
      .select('category:categories(name_en, name_ar)')
      .eq('id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBizCategory(getCategoryLabel(data.category as unknown as Category, lang))
      })
    supabase.auth.getUser().then(async ({ data: authData }) => {
      const userId = authData.user?.id
      if (!userId) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, handle')
        .eq('id', userId)
        .maybeSingle()
      const name = profile?.display_name ?? profile?.handle ?? authData.user?.user_metadata?.display_name
      if (name) setReviewerName(name)
    })
  }, [businessId])

  async function recordVideo() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert(t('permissionNeeded'), t('cameraPermissionMsg')); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: true, quality: 1, videoMaxDuration: 60 })
    if (!result.canceled) { setVideoUri(result.assets[0].uri); setTextExpanded(false) }
  }

  async function pickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert(t('permissionNeeded'), t('mediaPermissionMsg')); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: true, quality: 1 })
    if (!result.canceled) { setVideoUri(result.assets[0].uri); setTextExpanded(false) }
  }

  async function uploadToStorage(localUri: string, path: string, contentType: string, accessToken: string): Promise<string> {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
    const uploadUrl = `${supabaseUrl}/storage/v1/object/reviews/${path}`
    return new Promise((resolve, reject) => {
      const readXhr = new XMLHttpRequest()
      readXhr.open('GET', localUri)
      readXhr.responseType = 'blob'
      readXhr.onload = () => {
        const blob = readXhr.response
        if (!blob || blob.size === 0) { reject(new Error('Empty file')); return }
        const uploadXhr = new XMLHttpRequest()
        uploadXhr.open('POST', uploadUrl)
        uploadXhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
        uploadXhr.setRequestHeader('Content-Type', contentType)
        uploadXhr.setRequestHeader('x-upsert', 'true')
        uploadXhr.onload = () => {
          if (uploadXhr.status < 400) {
            resolve(`${supabaseUrl}/storage/v1/object/public/reviews/${path}`)
          } else {
            reject(new Error(`Upload failed (${uploadXhr.status}): ${uploadXhr.responseText}`))
          }
        }
        uploadXhr.onerror = () => reject(new Error('Upload failed'))
        uploadXhr.send(blob)
      }
      readXhr.onerror = () => reject(new Error('Failed to read file'))
      readXhr.send()
    })
  }

  async function submit() {
    if (!thumb) {
      setThumbError(true)
      setTimeout(() => setThumbError(false), 1000)
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/phone'); return }

      const fileBase = `${session.user.id}_${Date.now()}`
      const videoPath = `videos/${fileBase}.mp4`
      let video_url: string | null = null
      let thumbnail_url: string | null = null

      if (videoUri) {
        setUploadStep('Uploading video…')
        video_url = await uploadToStorage(videoUri, videoPath, 'video/mp4', session.access_token)

        setUploadStep('Analysing your review…')
      }

      let transcript_en = '', transcript_ar = ''
      let ai_likes_en: string[] = [], ai_likes_ar: string[] = []
      let ai_nopes_en: string[] = [], ai_nopes_ar: string[] = []

      if (videoUri) {
        try {
          const result = await processReview(videoPath, businessName)
          transcript_en = result.transcript_en
          transcript_ar = result.transcript_ar
          ai_likes_en = result.ai_likes_en
          ai_likes_ar = result.ai_likes_ar
          ai_nopes_en = result.ai_nopes_en
          ai_nopes_ar = result.ai_nopes_ar
        } catch (e: any) {
          console.error('AI processing failed:', e)
        }
      }

      setUploadStep('Saving…')
      const { data, error } = await supabase.from('reviews').insert({
        business_id: businessId,
        author_id: session.user.id,
        rating: thumb,
        language: lang,
        text: text.trim() || transcript_en || '',
        transcript_en: transcript_en || null,
        transcript_ar: transcript_ar || null,
        ai_likes_en: ai_likes_en.length > 0 ? ai_likes_en : null,
        ai_likes_ar: ai_likes_ar.length > 0 ? ai_likes_ar : null,
        ai_nopes_en: ai_nopes_en.length > 0 ? ai_nopes_en : null,
        ai_nopes_ar: ai_nopes_ar.length > 0 ? ai_nopes_ar : null,
        moderation_status: 'pending',
        video_url,
        thumbnail_url,
      }).select('id').single()

      if (error) { Alert.alert(t('error'), error.message); setSubmitting(false); return }
      setReviewId(data?.id ?? null)
      setDone(true)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    }
    setSubmitting(false)
    setUploadStep('')
  }

  if (done) {
    const isVideo = !!videoUri
    const isText = textExpanded && text.length > 0
    const successTitle = isVideo ? t('videoSubmitted') : isText ? t('textSubmitted') : t('ratingSubmitted')
    const successSub = isVideo ? t('videoSubmittedSub') : isText ? t('textSubmittedSub') : t('ratingSubmittedSub')

    const verdictThumb = THUMBS.find(th => th.v === thumb) ?? THUMBS[1]
    const shareData: ShareData = {
      reviewId: reviewId ?? '',
      reviewerName,
      verdictEmoji: verdictThumb.emoji,
      verdictLabel: t(verdictThumb.labelKey),
      businessName,
      category: bizCategory || undefined,
      text: isText ? text.trim() : undefined,
    }

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.successContainer, rtl]}>
          <View style={styles.successIconWrap}>
            {isVideo ? <Camera size={52} color="#2B8BFF" /> : isText ? <PenLine size={52} color="#7B2CFF" /> : <ThumbsUp size={52} color="#22c55e" />}
          </View>
          <Text style={[styles.successTitle, isRTL && { textAlign: 'center' }]}>{successTitle}</Text>
          <Text style={[styles.successSub, isRTL && { textAlign: 'center' }]}>{successSub}</Text>

          {isVideo && (
            <>
              <View style={[styles.captionBox, rtl]}>
                <Text style={[styles.captionLabel, isRTL && { textAlign: 'right' }]}>{t('captionWhenSharing')}</Text>
                <Text style={[styles.captionText, isRTL && { textAlign: 'right' }]}>{buildCaption(shareData)}</Text>
              </View>

              <TouchableOpacity style={styles.shareBtn} onPress={() => shareNative(shareData)}>
                <LinearGradient colors={['#25D366', '#128C7E']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.shareBtnGradient}>
                  <Share2 color="#fff" size={20} />
                  <Text style={styles.shareBtnText}>{t('shareYourReviewBtn')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/tabs/feed')}>
            <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.gradient}>
              <Text style={styles.doneBtnText}>{t('backToFeed')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity onPress={() => router.replace('/tabs/feed')}>
              <Text style={styles.skipText}>{t('skipSharing')}</Text>
            </TouchableOpacity>
          )}
          {reviewId && (
            <TouchableOpacity
              style={{ marginTop: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e2a3a', borderRadius: 24, width: '100%' }}
              onPress={() => router.push({ pathname: '/review-detail', params: { reviewId } })}
            >
              <Text style={{ color: '#5FA2FF', fontSize: 14 }}>{t('viewYourReview')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, rtl]}>
      <TouchableOpacity style={[styles.back, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => router.back()}>
        <ChevronLeft color="#fff" size={24} />
        <Text style={styles.backText}>{t('back')}</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, isRTL && { textAlign: 'right' }]}>{t('shareYourReview')}</Text>
        <Text style={[styles.subtitle, isRTL && { textAlign: 'right' }]}>{t('helpOthers')}</Text>

        <View style={[styles.bizRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <BusinessLogo name={businessName} logoUrl={businessLogo} size={36} />
          <Text style={styles.bizName}>{businessName}</Text>
        </View>

        <View style={styles.featuredPill}><Text style={styles.featuredText}>{t('featuredOnFeed')}</Text></View>
        <View style={[styles.videoHero, videoUri && styles.videoHeroSelected]}>
          <View style={styles.videoHeroIcon}>
            <Camera size={24} color="#fff" />
          </View>
          <Text style={[styles.videoHeroTitle, isRTL && { textAlign: 'center' }]}>
            {videoUri ? t('videoAdded') : t('addVideoReview')}
          </Text>
          <Text style={[styles.videoHeroSub, isRTL && { textAlign: 'center' }]}>
            {videoUri ? t('videoReady') : t('tapToRecordOrUpload')}
          </Text>
          {!videoUri && (
            <View style={[styles.videoSubOpts, isRTL && { flexDirection: 'row-reverse' }]}>
              <TouchableOpacity style={styles.videoSubBtn} onPress={recordVideo}>
                <Camera size={16} color="#2B8BFF" />
                <Text style={styles.videoSubText}>{t('recordNow')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.videoSubBtn} onPress={pickVideo}>
                <Upload size={16} color="#7B2CFF" />
                <Text style={styles.videoSubText}>{t('upload')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {videoUri && (
            <TouchableOpacity onPress={() => setVideoUri(null)}>
              <Text style={styles.removeVideo}>{t('removeVideo')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.textOption, textExpanded && styles.textOptionExpanded]}
          onPress={() => { if (!textExpanded) { setTextExpanded(true); setVideoUri(null) } }}
          activeOpacity={textExpanded ? 1 : 0.7}
        >
          <View style={[styles.textOptionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={styles.textOptionTitle}>✍️ {textExpanded ? t('writingReview') : t('writeInstead')}</Text>
            <View style={styles.optionalBadge}><Text style={styles.optionalText}>{t('optional')}</Text></View>
          </View>
          {textExpanded && (
            <TextInput
              style={[styles.textArea, isRTL && { textAlign: 'right', writingDirection: 'rtl' }]}
              placeholder={t('captionInputPlaceholder')}
              placeholderTextColor="#555"
              multiline
              numberOfLines={4}
              value={text}
              onChangeText={setText}
              autoFocus
            />
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('yourVerdictDivider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={[styles.verdictLabel, thumbError && styles.verdictError]}>
          {thumbError ? t('pleasePickVerdict') : thumb ? t('yourVerdictLabel') : t('pickVerdict')}
        </Text>
        <View style={[styles.thumbsRow, isRTL && { flexDirection: 'row-reverse' }]}>
          {THUMBS.map(({ v, labelKey, activeBg, activeBorder, activeText, activeCircle, Icon }) => {
            const active = thumb === v
            return (
              <TouchableOpacity
                key={v}
                style={[styles.thumbBtn, thumbError && styles.thumbError, active && { backgroundColor: activeBg, borderColor: activeBorder }]}
                onPress={() => { setThumb(v); setThumbError(false) }}
              >
                <View style={[styles.thumbCircle, active && { backgroundColor: activeCircle }]}>
                  <Icon stroke={active ? 'white' : '#9ca3af'} />
                </View>
                <Text style={[styles.thumbLabel, active && { color: activeText, fontWeight: '700' }]}>{t(labelKey)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
          <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.gradient}>
            {submitting
              ? <><ActivityIndicator color="#fff" />{uploadStep ? <Text style={[styles.submitText, { fontSize: 13, marginTop: 4 }]}>{uploadStep}</Text> : null}</>
              : <Text style={styles.submitText}>{t('submitReview')}</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', padding: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  backText: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#57534e', fontSize: 14, marginBottom: 20 },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#161b22', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1e2a3a' },
  bizName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  featuredPill: { backgroundColor: '#2B8BFF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  featuredText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  videoHero: { backgroundColor: '#161b22', borderWidth: 2, borderColor: '#1e2a3a', borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, marginBottom: 10 },
  videoHeroSelected: { borderColor: '#2B8BFF', backgroundColor: '#0f1e35' },
  videoHeroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2B8BFF', alignItems: 'center', justifyContent: 'center' },
  videoHeroTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  videoHeroSub: { color: '#5FA2FF', fontSize: 12 },
  videoSubOpts: { flexDirection: 'row', gap: 10, marginTop: 4 },
  videoSubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0D1117', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#1e2a3a' },
  videoSubText: { color: '#aaa', fontSize: 13 },
  removeVideo: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  textOption: { borderWidth: 1.5, borderColor: '#1e2a3a', borderRadius: 16, padding: 14, marginBottom: 16 },
  textOptionExpanded: { borderColor: '#2B8BFF' },
  textOptionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textOptionTitle: { color: '#888', fontSize: 14, fontWeight: '500' },
  optionalBadge: { backgroundColor: '#1e2a3a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  optionalText: { color: '#666', fontSize: 10 },
  textArea: { backgroundColor: '#0D1117', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, minHeight: 90, textAlignVertical: 'top', marginTop: 12, borderWidth: 1, borderColor: '#1e2a3a' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: '#1e2a3a' },
  dividerText: { color: '#444', fontSize: 11 },
  verdictLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  verdictError: { color: '#ef4444' },
  thumbsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  thumbBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 18, borderWidth: 2, borderColor: '#1e2a3a', backgroundColor: '#161b22', gap: 8 },
  thumbError: { borderColor: '#ef4444' },
  thumbCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  thumbLabel: { color: '#666', fontSize: 11, fontWeight: '500', textAlign: 'center' },
  submitBtn: { borderRadius: 24, overflow: 'hidden', marginBottom: 40 },
  gradient: { padding: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  successContainer: { alignItems: 'center', padding: 24, paddingTop: 48 },
  successIconWrap: { marginBottom: 16 },
  successTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  successSub: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  captionBox: { backgroundColor: '#161b22', borderRadius: 14, padding: 16, marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#1e2a3a' },
  captionLabel: { color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  captionText: { color: '#aaa', fontSize: 13, lineHeight: 20 },
  captionLink: { color: '#2B8BFF' },
  shareBtn: { borderRadius: 24, overflow: 'hidden', width: '100%', marginBottom: 16 },
  shareBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  doneBtn: { borderRadius: 24, overflow: 'hidden', width: '100%', marginBottom: 16 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  skipText: { color: '#444', fontSize: 13 },
})
