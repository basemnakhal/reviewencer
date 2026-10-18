import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { Fragment, useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, FlatList, Image, Modal,
  SafeAreaView, Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native'
import ReviewCard from '../../components/ReviewCard'
import { TierBadge } from '../../components/TierBadge'
import { useLanguage } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { type Lang } from '../../lib/translations'

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F0A500',
  '#DDA0DD', '#00B894', '#F7DC6F', '#6C5CE7', '#85C1E9',
  '#E17055', '#74B9FF', '#A29BFE', '#55EFC4', '#FD79A8',
]
function hashColor(str: string) {
  let hash = 0
  for (const c of str) { hash = c.charCodeAt(0) + ((hash << 5) - hash); hash |= 0 }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}
function fmtCount(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

type Profile = {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  tier: 'reviewer' | 'top_reviewer' | 'reviewencer'
  language: string
}

type Review = {
  id: string
  rating: number
  text: string | null
  video_url: string | null
  legit_count: number
  view_count: number
  share_count: number
  tags: string[]
  moderation_status: string
  created_at: string
  business: { name: string; slug: string; logo_url: string | null }
}


export default function MeScreen() {
  const { t, lang, setLang, isRTL, contentLang, setContentLang } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [menuReview, setMenuReview] = useState<Review | null>(null)
  const [editCaption, setEditCaption] = useState<{ id: string; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => { load() }, []))

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth/phone'); return }

    const [pRes, rRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('reviews').select(`
        id, rating, text, video_url, legit_count, view_count, share_count, tags,
        moderation_status, created_at,
        business:businesses(name:name_en, slug, logo_url)
      `).eq('author_id', session.user.id).order('created_at', { ascending: false }),
    ])

    if (pRes.data) {
      setProfile(pRes.data)
      if (pRes.data.language && pRes.data.language !== lang) {
        setLang(pRes.data.language as Lang)
      }
    }
    if (rRes.data) setReviews(rRes.data as any)
    setLoading(false)
  }

  async function deleteReview(id: string) {
    setMenuReview(null)
    Alert.alert(t('deleteReviewTitle'), t('deleteReviewMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('reviews').delete().eq('id', id)
          if (error) { Alert.alert(t('error'), error.message); return }
          setReviews(rs => rs.filter(r => r.id !== id))
        },
      },
    ])
  }

  async function saveCaption() {
    if (!editCaption) return
    setSaving(true)
    const { error } = await supabase.from('reviews')
      .update({ text: editCaption.text })
      .eq('id', editCaption.id)
    setSaving(false)
    if (error) { Alert.alert(t('error'), error.message); return }
    setReviews(rs => rs.map(r => r.id === editCaption.id ? { ...r, text: editCaption.text } : r))
    setEditCaption(null)
  }

  async function shareReview(review: Review) {
    setMenuReview(null)
    try {
      await Share.share({
        message: `${review.business.name} — reviewed on Reviewencer 🎬\nreviewencer.com/review/${review.id}`,
      })
    } catch {}
  }

  async function toggleLanguage() {
    if (!profile) return
    const next = (profile.language === 'ar' ? 'en' : 'ar') as Lang
    setProfile(p => p ? { ...p, language: next } : p)
    setLang(next)
    await supabase.from('profiles').update({ language: next }).eq('id', profile.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/auth/phone')
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#2B8BFF" size="large" /></View>
  if (!profile) return <View style={s.center}><Text style={{ color: '#666' }}>{t('profileNotFound')}</Text></View>

  const totalViews = reviews.reduce((n, r) => n + (r.view_count ?? 0), 0)
  const totalLegit = reviews.reduce((n, r) => n + (r.legit_count ?? 0), 0)
  const avatarColor = hashColor(profile.handle)

  const ListHeader = (
    <View style={rtl}>
      <View style={s.profileSection}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={[s.avatar, { borderColor: avatarColor }]} />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: avatarColor }]}>
            <Text style={s.avatarText}>{initials(profile.display_name)}</Text>
          </View>
        )}
        <Text style={s.displayName}>{profile.display_name}</Text>
        <Text style={s.handle}>@{profile.handle}</Text>
        <TierBadge tier={profile.tier} variant="dark" />
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statNum}>{reviews.length}</Text>
          <Text style={s.statLabel}>{t('reviews')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statNum}>{fmtCount(totalViews)}</Text>
          <Text style={s.statLabel}>{t('views')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statNum}>{fmtCount(totalLegit)}</Text>
          <Text style={s.statLabel}>{t('legit')}</Text>
        </View>
      </View>

      {reviews.length > 0 && <Text style={[s.sectionLabel, isRTL && { textAlign: 'right' }]}>{t('myReviews')}</Text>}
    </View>
  )

  const ListFooter = (
    <View style={[s.settingsSection, rtl]}>
      <Text style={[s.sectionLabel, isRTL && { textAlign: 'right' }]}>{t('settings')}</Text>

      <TouchableOpacity style={s.settingRow} onPress={() => router.push('/profile/edit')}>
        <Text style={s.settingIcon}>✏️</Text>
        <Text style={s.settingText}>{t('editProfile')}</Text>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.settingRow} onPress={toggleLanguage}>
        <Text style={s.settingIcon}>🌐</Text>
        <Text style={s.settingText}>{t('language')}</Text>
        <View style={s.langToggle}>
          <Text style={[s.langOpt, lang !== 'ar' && s.langOptActive]}>EN</Text>
          <Text style={s.langDot}> · </Text>
          <Text style={[s.langOpt, lang === 'ar' && s.langOptActive]}>AR</Text>
        </View>
      </TouchableOpacity>

      <View style={s.settingRow}>
        <Text style={s.settingIcon}>📺</Text>
        <Text style={s.settingText}>{t('contentLanguage')}</Text>
        <View style={s.langToggle}>
          {(['en', 'ar', 'both'] as const).map((opt, i) => (
            <Fragment key={opt}>
              {i > 0 && <Text style={s.langDot}> · </Text>}
              <TouchableOpacity onPress={() => setContentLang(opt)}>
                <Text style={[s.langOpt, contentLang === opt && s.langOptActive]}>
                  {opt === 'both' ? t('contentLangBoth') : opt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </Fragment>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[s.settingRow, { marginTop: 8, borderColor: '#2a1515' }]} onPress={signOut}>
        <Text style={[s.settingText, { color: '#ef4444' }]}>{t('signOut')}</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={reviews}
        keyExtractor={r => r.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[s.emptyWrap, rtl]}>
            <Text style={s.emptyEmoji}>🎬</Text>
            <Text style={[s.emptyTitle, isRTL && { textAlign: 'center' }]}>{t('noMyReviews')}</Text>
            <Text style={[s.emptySub, isRTL && { textAlign: 'center' }]}>{t('noMyReviewsSub')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            {item.moderation_status === 'pending' && (
              <View style={[s.pendingBar, rtl]}>
                <Text style={s.pendingText}>{t('pendingApproval')}</Text>
              </View>
            )}
            <View style={{ position: 'relative' }}>
              <ReviewCard
                {...item}
                author={{
                  display_name: profile.display_name,
                  handle: profile.handle,
                  avatar_url: profile.avatar_url ?? undefined,
                  tier: profile.tier,
                }}
                isLegitByMe={false}
              />
              <TouchableOpacity style={s.menuBtn} onPress={() => setMenuReview(item)}>
                <Text style={s.menuDots}>···</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* 3-dot action sheet */}
      <Modal visible={!!menuReview} transparent animationType="slide" onRequestClose={() => setMenuReview(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setMenuReview(null)}>
          <View style={[s.sheet, rtl]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetBiz, isRTL && { textAlign: 'right' }]} numberOfLines={1}>{menuReview?.business?.name}</Text>

            {menuReview?.moderation_status === 'pending' && (
              <TouchableOpacity style={s.sheetRow} onPress={() => {
                setEditCaption({ id: menuReview.id, text: menuReview.text ?? '' })
                setMenuReview(null)
              }}>
                <Text style={[s.sheetRowText, isRTL && { textAlign: 'right' }]}>{t('menuEditCaption')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.sheetRow} onPress={() => menuReview && shareReview(menuReview)}>
              <Text style={[s.sheetRowText, isRTL && { textAlign: 'right' }]}>{t('menuShare')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.sheetRow} onPress={() => menuReview && deleteReview(menuReview.id)}>
              <Text style={[s.sheetRowText, { color: '#ef4444' }, isRTL && { textAlign: 'right' }]}>{t('menuDelete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit caption modal */}
      <Modal visible={!!editCaption} transparent animationType="fade" onRequestClose={() => setEditCaption(null)}>
        <View style={s.editOverlay}>
          <View style={[s.editBox, rtl]}>
            <Text style={[s.editTitle, isRTL && { textAlign: 'right' }]}>{t('editCaptionTitle')}</Text>
            <TextInput
              style={[s.editInput, isRTL && { textAlign: 'right', writingDirection: 'rtl' }]}
              value={editCaption?.text ?? ''}
              onChangeText={v => setEditCaption(c => c ? { ...c, text: v } : c)}
              placeholder={t('captionPlaceholder')}
              placeholderTextColor="#444"
              multiline
              autoFocus
            />
            <View style={s.editActions}>
              <TouchableOpacity style={s.editCancel} onPress={() => setEditCaption(null)}>
                <Text style={s.editCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editSave} onPress={saveCaption} disabled={saving}>
                <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.editSaveGrad}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.editSaveText}>{t('save')}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  center: { flex: 1, backgroundColor: '#0D1117', alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingTop: 8 },

  profileSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, marginBottom: 12 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  displayName: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  handle: { color: '#555', fontSize: 13, marginBottom: 10 },

  statsRow: {
    flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 16,
    borderWidth: 1, borderColor: '#1e2a3a', marginBottom: 24, paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#555', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#1e2a3a', marginVertical: 4 },

  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

  cardWrap: { marginBottom: 4 },
  pendingBar: {
    backgroundColor: '#1c1a0a', borderWidth: 1, borderColor: '#3a3000',
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, marginBottom: 1,
  },
  pendingText: { color: '#F0A500', fontSize: 12, fontWeight: '600' },
  menuBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(13,17,23,0.85)', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 3, zIndex: 10,
  },
  menuDots: { color: '#888', fontSize: 18, letterSpacing: 1 },

  emptyWrap: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 13 },

  settingsSection: { marginTop: 24, marginBottom: 40 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161b22', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a3a',
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
  },
  settingIcon: { fontSize: 16 },
  settingText: { flex: 1, color: '#ccc', fontSize: 15 },
  chevron: { color: '#333', fontSize: 22 },
  langToggle: { flexDirection: 'row', alignItems: 'center' },
  langOpt: { color: '#444', fontSize: 13, fontWeight: '700' },
  langOptActive: { color: '#2B8BFF' },
  langDot: { color: '#333', fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#161b22', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 44,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  sheetBiz: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  sheetRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1e2a3a' },
  sheetRowText: { color: '#ccc', fontSize: 15 },

  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  editBox: { backgroundColor: '#161b22', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e2a3a' },
  editTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  editInput: {
    backgroundColor: '#0D1117', borderRadius: 12, borderWidth: 1, borderColor: '#1e2a3a',
    color: '#fff', fontSize: 14, padding: 12, minHeight: 100, textAlignVertical: 'top', marginBottom: 16,
  },
  editActions: { flexDirection: 'row', gap: 10 },
  editCancel: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#1e2a3a',
  },
  editCancelText: { color: '#666', fontSize: 15 },
  editSave: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  editSaveGrad: { paddingVertical: 12, alignItems: 'center' },
  editSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
