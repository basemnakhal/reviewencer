import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Search, ChevronLeft } from 'lucide-react-native'
import { router } from 'expo-router'
import { BusinessLogo } from '../components/BusinessLogo'
import { type Category, getCategoryLabel } from '../lib/categories'
import { supabase } from '../lib/supabase'
import { ThumbPicker, ThumbValue } from '../components/ThumbPicker'

type Business = { id: string; name: string; logo_url: string | null; category: Category | null }

export default function SubmitScreen() {
  const [step, setStep] = useState<'business' | 'details'>('business')
  const [search, setSearch] = useState('')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selected, setSelected] = useState<Business | null>(null)
  const [rating, setRating] = useState<ThumbValue>(5)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function searchBusinesses(q: string) {
    setSearch(q)
    if (q.length < 2) { setBusinesses([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('businesses')
      .select('id, name:name_en, logo_url, category:categories(name_en, name_ar)')
      .ilike('name_en', `%${q}%`)
      .limit(10)
    setBusinesses((data as unknown as Business[]) ?? [])
    setLoading(false)
  }

  async function submit() {
    if (!selected) {
      Alert.alert('Missing info', 'Please select a business.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('reviews').insert({
      business_id: selected.id,
      rating,
      text,
      moderation_status: 'pending',
    })
    setSubmitting(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Submitted! 🎉', 'Your review is being reviewed and will be published shortly.', [
        { text: 'OK', onPress: () => router.replace('/tabs/feed') }
      ])
    }
  }

  if (step === 'business') {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <ChevronLeft color="#fff" size={24} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Which business?</Text>
        <Text style={styles.subtitle}>Search for the place you're reviewing</Text>
        <View style={styles.searchBox}>
          <Search size={18} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. Talabat, Uber..."
            placeholderTextColor="#555"
            value={search}
            onChangeText={searchBusinesses}
            autoFocus
          />
          {loading && <ActivityIndicator size="small" color="#2B8BFF" />}
        </View>
        <ScrollView style={styles.results}>
          {businesses.map(b => (
            <TouchableOpacity key={b.id} style={styles.businessRow} onPress={() => { setSelected(b); setStep('details') }}>
              <BusinessLogo name={b.name} logoUrl={b.logo_url} size={36} />
              <View>
                <Text style={styles.businessName}>{b.name}</Text>
                <Text style={styles.businessCat}>{getCategoryLabel(b.category)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {search.length >= 2 && businesses.length === 0 && !loading && (
            <Text style={styles.noResults}>No businesses found. Ask us to add it!</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => setStep('business')}>
        <ChevronLeft color="#fff" size={24} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>How was it?</Text>
        <View style={styles.selectedBiz}>
          {selected && <BusinessLogo name={selected.name} logoUrl={selected.logo_url} size={28} />}
          <Text style={styles.businessName}>{selected?.name}</Text>
        </View>
        <Text style={styles.label}>Your verdict</Text>
        <ThumbPicker value={rating} onChange={setRating} />
        <Text style={[styles.label, { marginTop: 28 }]}>Add a caption (optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="What did you love or hate?"
          placeholderTextColor="#555"
          multiline
          numberOfLines={4}
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
          <LinearGradient colors={['#2B8BFF', '#7B2CFF']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.gradient}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Review 🎬</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', padding: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
  backText: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { color: '#57534e', fontSize: 14, marginBottom: 24 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: '#1e2a3a' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  results: { marginTop: 16 },
  businessRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, backgroundColor: '#161b22', marginBottom: 8 },
  businessName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  businessCat: { color: '#666', fontSize: 12, marginTop: 2 },
  noResults: { color: '#666', textAlign: 'center', marginTop: 24 },
  selectedBiz: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#161b22', padding: 16, borderRadius: 12, marginBottom: 28 },
  label: { color: '#888', fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  textInput: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 28, borderWidth: 1, borderColor: '#1e2a3a', marginTop: 12 },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 40 },
  gradient: { padding: 18, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
})
