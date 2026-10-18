import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Platform, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
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
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); hash |= 0 }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function nameToHandle(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 20)
}

type AvatarMode = 'initials' | 'dicebear' | 'upload'
type Step = 'language' | 'profile'

export default function OnboardingScreen() {
  const { t, lang, setLang, isRTL } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const [step, setStep] = useState<Step>('language')
  const [selectedLang, setSelectedLang] = useState<Lang | null>(null)

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [handleEdited, setHandleEdited] = useState(false)
  const [handleTaken, setHandleTaken] = useState(false)
  const [checkingHandle, setCheckingHandle] = useState(false)
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('initials')
  const [uploadedUri, setUploadedUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!handleEdited && name) setHandle(nameToHandle(name))
  }, [name])

  useEffect(() => {
    if (!handle) { setHandleTaken(false); return }
    const t = setTimeout(checkHandle, 500)
    return () => clearTimeout(t)
  }, [handle])

  function pickLanguage(l: Lang) {
    setSelectedLang(l)
    setLang(l)
  }

  async function checkHandle() {
    setCheckingHandle(true)
    const { data } = await supabase.from('profiles').select('id').eq('handle', handle.trim()).maybeSingle()
    setHandleTaken(!!data)
    setCheckingHandle(false)
  }

  function pickPhoto() {
    Alert.alert(t('choosePhotoTitle'), undefined, [
      {
        text: t('takePhoto'), onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== 'granted') { Alert.alert(t('permissionNeeded'), t('cameraPermissionMsg')); return }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
          if (!result.canceled) { setUploadedUri(result.assets[0].uri); setAvatarMode('upload') }
        },
      },
      {
        text: t('chooseFromLibrary'), onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') { Alert.alert(t('permissionNeeded'), t('photoPermissionMsg')); return }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 })
          if (!result.canceled) { setUploadedUri(result.assets[0].uri); setAvatarMode('upload') }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ])
  }

  async function submit() {
    if (!name.trim()) { Alert.alert(t('nameRequired'), t('nameRequiredMsg')); return }
    if (!handle.trim()) { Alert.alert(t('handleRequired'), t('handleRequiredMsg')); return }
    if (handleTaken) { Alert.alert(t('handleTakenAlert'), t('handleTakenMsg')); return }

    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth/phone'); return }

    let avatarUrl: string | null = null

    if (avatarMode === 'upload' && uploadedUri) {
      try {
        const ext = uploadedUri.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${session.user.id}.${ext}`
        const res = await fetch(uploadedUri)
        const blob = await res.blob()
        await supabase.storage.from('avatars').upload(fileName, blob, { contentType: `image/${ext}`, upsert: true })
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
        avatarUrl = publicUrl
      } catch {
        // fall back to initials silently
      }
    } else if (avatarMode === 'dicebear') {
      avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(handle)}&backgroundColor=b6e3f4,c0aede,d1d4f9`
    }

    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      display_name: name.trim(),
      handle: handle.trim(),
      avatar_url: avatarUrl,
      phone: session.user.phone ?? null,
      language: lang,
    })

    setSubmitting(false)
    if (error) { Alert.alert(t('error'), error.message); return }
    router.replace('/tabs/feed')
  }

  const avatarColor = hashColor(handle || name || 'x')
  const nameInitials = initials(name || '?')
  const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(handle || 'default')}&backgroundColor=b6e3f4`

  if (step === 'language') {
    return (
      <SafeAreaView style={s.container}>
        <View style={[s.langScreen, rtl]}>
          <Text style={s.langEmoji}>🌍</Text>
          <Text style={[s.langHeading, isRTL && { textAlign: 'center' }]}>{t('chooseLanguage')}</Text>
          <Text style={[s.langSub, isRTL && { textAlign: 'center' }]}>{t('chooseLanguageSub')}</Text>

          <TouchableOpacity
            style={[s.langCard, selectedLang === 'en' && s.langCardActive]}
            onPress={() => pickLanguage('en')}
            activeOpacity={0.8}
          >
            <Text style={s.langCardFlag}>🇬🇧</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.langCardName}>English</Text>
              <Text style={s.langCardNative}>English</Text>
            </View>
            {selectedLang === 'en' && <Text style={s.langCardCheck}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.langCard, selectedLang === 'ar' && s.langCardActive]}
            onPress={() => pickLanguage('ar')}
            activeOpacity={0.8}
          >
            <Text style={s.langCardFlag}>🇦🇪</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.langCardName}>Arabic</Text>
              <Text style={s.langCardNative}>عربي</Text>
            </View>
            {selectedLang === 'ar' && <Text style={s.langCardCheck}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btn, !selectedLang && s.btnDisabled]}
            onPress={() => selectedLang && setStep('profile')}
            disabled={!selectedLang}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={selectedLang ? ['#2B8BFF', '#7B2CFF'] : ['#1a1a2a', '#1a1a2a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.gradient}
            >
              <Text style={[s.btnText, !selectedLang && s.btnTextDim]}>{t('continueBtn')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scroll, rtl]} keyboardShouldPersistTaps="handled">

          <Text style={[s.heading, isRTL && { textAlign: 'right' }]}>{t('setupProfile')}</Text>
          <Text style={[s.sub, isRTL && { textAlign: 'right' }]}>{t('setupProfileSub')}</Text>

          <View style={s.avatarSection}>
            {avatarMode === 'upload' && uploadedUri ? (
              <Image source={{ uri: uploadedUri }} style={s.avatarPreview} />
            ) : avatarMode === 'dicebear' ? (
              <Image source={{ uri: dicebearUrl }} style={s.avatarPreview} />
            ) : (
              <View style={[s.avatarPreview, { backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={s.avatarInitials}>{nameInitials}</Text>
              </View>
            )}

            <View style={s.avatarOptions}>
              <TouchableOpacity style={[s.avatarOpt, avatarMode === 'initials' && s.avatarOptActive]} onPress={() => setAvatarMode('initials')}>
                <Text style={s.avatarOptEmoji}>✨</Text>
                <Text style={s.avatarOptLabel}>{t('initials')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.avatarOpt, avatarMode === 'dicebear' && s.avatarOptActive]} onPress={() => setAvatarMode('dicebear')}>
                <Text style={s.avatarOptEmoji}>🎭</Text>
                <Text style={s.avatarOptLabel}>{t('avatar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.avatarOpt, avatarMode === 'upload' && s.avatarOptActive]} onPress={pickPhoto}>
                <Text style={s.avatarOptEmoji}>📷</Text>
                <Text style={s.avatarOptLabel}>{t('photo')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.label, isRTL && { textAlign: 'right' }]}>{t('fullName')}</Text>
            <TextInput
              style={[s.input, isRTL && { textAlign: 'right' }]}
              value={name}
              onChangeText={setName}
              placeholder={t('namePlaceholder')}
              placeholderTextColor="#444"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.label, isRTL && { textAlign: 'right' }]}>{t('username')}</Text>
            <View style={s.handleRow}>
              <Text style={s.handleAt}>@</Text>
              <TextInput
                style={[s.input, s.handleInput, handleTaken && s.inputError]}
                value={handle}
                onChangeText={v => {
                  setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  setHandleEdited(true)
                }}
                placeholder="your_handle"
                placeholderTextColor="#444"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={20}
              />
              <View style={s.handleStatusWrap}>
                {checkingHandle
                  ? <ActivityIndicator size="small" color="#555" />
                  : handle
                    ? <Text style={{ color: handleTaken ? '#ef4444' : '#22c55e', fontSize: 16, fontWeight: '700' }}>
                        {handleTaken ? '✗' : '✓'}
                      </Text>
                    : null}
              </View>
            </View>
            {handleTaken && (
              <Text style={s.errorHint}>
                {t('handleTakenPrefix')}{handle}{t('handleTakenSuffix')}
              </Text>
            )}
          </View>

          <TouchableOpacity style={s.btn} onPress={submit} disabled={submitting} activeOpacity={0.85}>
            <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradient}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('getStarted')}</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  // Language picker
  langScreen: { flex: 1, padding: 24, paddingTop: 60, alignItems: 'stretch' },
  langEmoji: { fontSize: 56, textAlign: 'center', marginBottom: 20 },
  langHeading: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  langSub: { color: '#666', fontSize: 14, marginBottom: 36, textAlign: 'center' },
  langCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#161b22', borderRadius: 16, borderWidth: 1.5, borderColor: '#1e2a3a',
    paddingHorizontal: 20, paddingVertical: 18, marginBottom: 12,
  },
  langCardActive: { borderColor: '#2B8BFF', backgroundColor: '#0a1929' },
  langCardFlag: { fontSize: 32 },
  langCardName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  langCardNative: { color: '#555', fontSize: 13, marginTop: 2 },
  langCardCheck: { color: '#2B8BFF', fontSize: 20, fontWeight: '700' },
  // Profile form
  scroll: { flexGrow: 1, padding: 24, paddingTop: 52 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#666', fontSize: 14, marginBottom: 36 },
  avatarSection: { alignItems: 'center', marginBottom: 36 },
  avatarPreview: { width: 96, height: 96, borderRadius: 48, marginBottom: 16, borderWidth: 3, borderColor: '#1e2a3a' },
  avatarInitials: { color: '#fff', fontSize: 34, fontWeight: '700' },
  avatarOptions: { flexDirection: 'row', gap: 10 },
  avatarOpt: {
    alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#1e2a3a', backgroundColor: '#161b22', gap: 4,
  },
  avatarOptActive: { borderColor: '#2B8BFF', backgroundColor: '#0a1929' },
  avatarOptEmoji: { fontSize: 20 },
  avatarOptLabel: { color: '#777', fontSize: 11 },
  fieldGroup: { marginBottom: 20 },
  label: { color: '#777', fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#161b22', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a3a',
    color: '#fff', fontSize: 15, paddingHorizontal: 16, paddingVertical: 14,
  },
  inputError: { borderColor: '#ef4444' },
  handleRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  handleAt: { color: '#555', fontSize: 16, position: 'absolute', left: 14, zIndex: 1 },
  handleInput: { flex: 1, paddingLeft: 28 },
  handleStatusWrap: { position: 'absolute', right: 14, width: 24, alignItems: 'center' },
  errorHint: { color: '#ef4444', fontSize: 11, marginTop: 5, marginLeft: 4 },
  btn: { borderRadius: 16, overflow: 'hidden', marginTop: 8, marginBottom: 32 },
  btnDisabled: {},
  gradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnTextDim: { color: '#555' },
})
