import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, SafeAreaView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useLanguage } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

const CODE_LENGTH = 6

export default function VerifyScreen() {
  const { t, isRTL } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const { phone, display, bypass } = useLocalSearchParams<{ phone: string; display: string; bypass?: string }>()
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const inputs = useRef<(TextInput | null)[]>(Array(CODE_LENGTH).fill(null))

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  useEffect(() => {
    if (bypass !== '1') return
    setDigits('000000'.split(''))
    const t = setTimeout(() => verify('000000'), 400)
    return () => clearTimeout(t)
  }, [])

  function handleChange(text: string, i: number) {
    const digit = text.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    if (digit && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus()
    if (next.every(d => d !== '')) verify(next.join(''))
  }

  function handleKeyPress(key: string, i: number) {
    if (key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]
      next[i - 1] = ''
      setDigits(next)
      inputs.current[i - 1]?.focus()
    }
  }

  async function verify(token: string) {
    if (token.length < CODE_LENGTH) return
    setVerifying(true)
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) {
      setVerifying(false)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputs.current[0]?.focus()
      Alert.alert(t('incorrectCode'), t('incorrectCodeMsg'))
      return
    }
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('id', data.user!.id).single()
    router.replace(profile ? '/tabs/feed' : '/auth/onboarding')
  }

  async function resend() {
    setResending(true)
    const { error } = await supabase.auth.signInWithOtp({ phone })
    setResending(false)
    if (error) { Alert.alert(t('error'), error.message); return }
    setCountdown(30)
    setDigits(Array(CODE_LENGTH).fill(''))
    inputs.current[0]?.focus()
  }

  const allFilled = digits.every(d => d !== '')

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[s.inner, rtl]}>

          <Text style={s.emoji}>📱</Text>
          <Text style={[s.heading, isRTL && { textAlign: 'right' }]}>{t('checkSms')}</Text>
          <Text style={[s.sub, isRTL && { textAlign: 'right' }]}>
            {t('codeSentTo')}{'\n'}
            <Text style={s.phone}>{display ?? phone}</Text>
          </Text>

          <View style={s.codeRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={r => { inputs.current[i] = r }}
                style={[s.box, d ? s.boxFilled : null, verifying ? s.boxVerifying : null]}
                value={d}
                onChangeText={t => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
                selectionColor="#2B8BFF"
                editable={!verifying}
                autoFocus={i === 0}
              />
            ))}
          </View>

          {verifying ? (
            <View style={s.verifyingRow}>
              <ActivityIndicator color="#7B2CFF" size="small" />
              <Text style={s.verifyingText}>{t('verifying')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={s.btn}
              onPress={() => verify(digits.join(''))}
              disabled={!allFilled}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={allFilled ? ['#2B8BFF', '#7B2CFF'] : ['#161b22', '#161b22']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.gradient}
              >
                <Text style={[s.btnText, !allFilled && s.btnTextDim]}>{t('verifyBtn')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={s.resendRow}>
            {countdown > 0 ? (
              <Text style={s.countdownText}>
                {t('resendInPrefix')}{countdown}{t('resendInSuffix')}
              </Text>
            ) : (
              <TouchableOpacity onPress={resend} disabled={resending}>
                <Text style={s.resendText}>{resending ? t('verifying') : t('resendCode')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>{t('wrongNumber')}</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  inner: { flex: 1, padding: 24, paddingTop: 64, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 16 },
  heading: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  phone: { color: '#ccc', fontWeight: '600' },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  box: {
    width: 46, height: 58, borderRadius: 12, borderWidth: 1.5, borderColor: '#1e2a3a',
    backgroundColor: '#161b22', color: '#fff', fontSize: 24, fontWeight: '700',
  },
  boxFilled: { borderColor: '#2B8BFF' },
  boxVerifying: { borderColor: '#7B2CFF' },
  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24, height: 56 },
  verifyingText: { color: '#7B2CFF', fontSize: 14 },
  btn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnTextDim: { color: '#444' },
  resendRow: { alignItems: 'center', marginBottom: 24 },
  countdownText: { color: '#444', fontSize: 13 },
  resendText: { color: '#2B8BFF', fontSize: 14, fontWeight: '600' },
  back: { marginTop: 'auto', paddingBottom: 8 },
  backText: { color: '#555', fontSize: 13 },
})
