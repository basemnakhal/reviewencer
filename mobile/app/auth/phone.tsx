import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useLanguage } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

const COUNTRIES = [
  { flag: '🇦🇪', name: 'UAE',          code: '+971' },
  { flag: '🇸🇦', name: 'Saudi Arabia', code: '+966' },
  { flag: '🇶🇦', name: 'Qatar',        code: '+974' },
  { flag: '🇰🇼', name: 'Kuwait',       code: '+965' },
  { flag: '🇧🇭', name: 'Bahrain',      code: '+973' },
  { flag: '🇴🇲', name: 'Oman',         code: '+968' },
  { flag: '🇯🇴', name: 'Jordan',       code: '+962' },
  { flag: '🇱🇧', name: 'Lebanon',      code: '+961' },
  { flag: '🇪🇬', name: 'Egypt',        code: '+20'  },
  { flag: '🇬🇧', name: 'UK',           code: '+44'  },
  { flag: '🇺🇸', name: 'USA',          code: '+1'   },
  { flag: '🇮🇳', name: 'India',        code: '+91'  },
  { flag: '🇵🇰', name: 'Pakistan',     code: '+92'  },
  { flag: '🇵🇭', name: 'Philippines',  code: '+63'  },
]

export default function PhoneScreen() {
  const { t, isRTL } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const [country, setCountry] = useState(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  async function sendOtp() {
    const digits = phone.replace(/\s/g, '')
    if (digits.length < 7) { Alert.alert(t('invalidNumber'), t('invalidNumberMsg')); return }
    const fullPhone = `${country.code}${digits}`
    const bypass = process.env.EXPO_PUBLIC_ENV === 'development' && fullPhone === '+971000000000'
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    setSending(false)
    if (error) { Alert.alert(t('error'), error.message); return }
    router.push({
      pathname: '/auth/verify',
      params: { phone: fullPhone, display: `${country.code} ${phone}`, ...(bypass ? { bypass: '1' } : {}) },
    })
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scroll, rtl]} keyboardShouldPersistTaps="handled">

          <View style={s.brand}>
            <Text style={s.brandEmoji}>🎬</Text>
            <Text style={s.brandName}>Reviewencer</Text>
            <Text style={s.tagline}>{t('appTagline')}</Text>
          </View>

          <Text style={[s.heading, isRTL && { textAlign: 'right' }]}>{t('welcomeHeading')}</Text>
          <Text style={[s.sub, isRTL && { textAlign: 'right' }]}>{t('welcomeSub')}</Text>

          <View style={[s.phoneRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={s.countryBtn} onPress={() => setShowPicker(true)}>
              <Text style={s.countryFlag}>{country.flag}</Text>
              <Text style={s.countryCode}>{country.code}</Text>
            </TouchableOpacity>
            <TextInput
              style={[s.phoneInput, isRTL && { textAlign: 'right' }]}
              placeholder="50 123 4567"
              placeholderTextColor="#444"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={sendOtp}
            />
          </View>

          <TouchableOpacity style={s.btn} onPress={sendOtp} disabled={sending} activeOpacity={0.85}>
            <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradient}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('sendOtp')}</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[s.disclaimer, isRTL && { textAlign: 'right' }]}>{t('otpDisclaimer')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={[s.sheet, rtl]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, isRTL && { textAlign: 'right' }]}>{t('selectCountry')}</Text>
            <ScrollView>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code + c.name}
                  style={[s.countryRow, c.code === country.code && c.name === country.name && s.countryRowActive]}
                  onPress={() => { setCountry(c); setShowPicker(false) }}
                >
                  <Text style={s.rowFlag}>{c.flag}</Text>
                  <Text style={s.rowName}>{c.name}</Text>
                  <Text style={s.rowCode}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  brand: { alignItems: 'center', marginBottom: 52 },
  brandEmoji: { fontSize: 60 },
  brandName: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 10 },
  tagline: { color: '#555', fontSize: 13, marginTop: 4 },
  heading: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#666', fontSize: 14, marginBottom: 28 },
  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  countryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#161b22', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a3a',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  countryFlag: { fontSize: 20 },
  countryCode: { color: '#fff', fontSize: 15, fontWeight: '600' },
  phoneInput: {
    flex: 1, backgroundColor: '#161b22', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a3a',
    color: '#fff', fontSize: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  btn: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { color: '#444', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#161b22', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 40, maxHeight: '70%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 16, marginLeft: 4 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10 },
  countryRowActive: { backgroundColor: '#1e2a3a' },
  rowFlag: { fontSize: 24 },
  rowName: { flex: 1, color: '#ccc', fontSize: 15 },
  rowCode: { color: '#555', fontSize: 14 },
})
