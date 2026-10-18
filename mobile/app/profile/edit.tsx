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

type AvatarMode = 'initials' | 'dicebear' | 'upload'

export default function EditProfileScreen() {
  const { t, isRTL } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const [userId, setUserId] = useState<string | null>(null)
  const [originalHandle, setOriginalHandle] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [handleTaken, setHandleTaken] = useState(false)
  const [checkingHandle, setCheckingHandle] = useState(false)
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('initials')
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
  const [uploadedUri, setUploadedUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    if (!handle || handle === originalHandle) { setHandleTaken(false); return }
    const t = setTimeout(checkHandle, 500)
    return () => clearTimeout(t)
  }, [handle])

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth/phone'); return }
    setUserId(session.user.id)
    const { data } = await supabase
      .from('profiles')
      .select('display_name, handle, avatar_url')
      .eq('id', session.user.id)
      .single()
    if (!data) return
    setName(data.display_name ?? '')
    setHandle(data.handle ?? '')
    setOriginalHandle(data.handle ?? '')
    setExistingAvatarUrl(data.avatar_url)
    if (!data.avatar_url) setAvatarMode('initials')
    else if (data.avatar_url.includes('dicebear')) setAvatarMode('dicebear')
    else setAvatarMode('upload')
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

  async function save() {
    if (!name.trim()) { Alert.alert(t('nameRequired')); return }
    if (!handle.trim()) { Alert.alert(t('handleRequired')); return }
    if (handleTaken) { Alert.alert(t('handleTakenAlert'), t('handleTakenMsg')); return }
    if (!userId) return

    setSaving(true)
    let avatarUrl: string | null = existingAvatarUrl

    if (avatarMode === 'initials') {
      avatarUrl = null
    } else if (avatarMode === 'dicebear') {
      avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(handle)}&backgroundColor=b6e3f4,c0aede,d1d4f9`
    } else if (avatarMode === 'upload' && uploadedUri) {
      try {
        const ext = uploadedUri.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${userId}.${ext}`
        const res = await fetch(uploadedUri)
        const blob = await res.blob()
        await supabase.storage.from('avatars').upload(fileName, blob, { contentType: `image/${ext}`, upsert: true })
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
        avatarUrl = publicUrl
      } catch {
        // keep existing avatar on upload failure
      }
    }

    const { error } = await supabase.from('profiles').update({
      display_name: name.trim(),
      handle: handle.trim(),
      avatar_url: avatarUrl,
    }).eq('id', userId)

    setSaving(false)
    if (error) { Alert.alert(t('error'), error.message); return }
    router.back()
  }

  const avatarColor = hashColor(handle || name || 'x')
  const nameInitials = initials(name || '?')
  const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(handle || 'default')}&backgroundColor=b6e3f4`
  const previewUri = avatarMode === 'upload'
    ? (uploadedUri ?? existingAvatarUrl)
    : avatarMode === 'dicebear' ? dicebearUrl : null

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scroll, rtl]} keyboardShouldPersistTaps="handled">

          <View style={[s.topBar, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={s.back}>{t('back')}</Text>
            </TouchableOpacity>
            <Text style={s.pageTitle}>{t('editProfileTitle')}</Text>
            <View style={{ width: 52 }} />
          </View>

          <View style={s.avatarSection}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={[s.avatarPreview, { borderColor: avatarColor }]} />
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
                onChangeText={v => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_handle"
                placeholderTextColor="#444"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
              />
              <View style={s.handleStatus}>
                {checkingHandle
                  ? <ActivityIndicator size="small" color="#555" />
                  : handle && handle !== originalHandle
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

          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradient}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('saveChanges')}</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { flexGrow: 1, padding: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  back: { color: '#2B8BFF', fontSize: 15 },
  pageTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarPreview: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, marginBottom: 16 },
  avatarInitials: { color: '#fff', fontSize: 30, fontWeight: '700' },
  avatarOptions: { flexDirection: 'row', gap: 10 },
  avatarOpt: {
    alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#1e2a3a', backgroundColor: '#161b22', gap: 4,
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
  handleStatus: { position: 'absolute', right: 14, width: 24, alignItems: 'center' },
  errorHint: { color: '#ef4444', fontSize: 11, marginTop: 5, marginLeft: 4 },
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8, marginBottom: 32 },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
