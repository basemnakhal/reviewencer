import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native'
import { useState } from 'react'
import { Search } from 'lucide-react-native'
import { router } from 'expo-router'
import { BusinessLogo } from '../../components/BusinessLogo'
import { type Category, getCategoryLabel } from '../../lib/categories'
import { useLanguage } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

type Business = { id: string; name: string; logo_url: string | null; category: Category | null }

export default function RecordScreen() {
  const { t, isRTL, lang } = useLanguage()
  const rtl = isRTL ? { direction: 'rtl' as const } : {}

  const [search, setSearch] = useState('')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(false)

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

  function selectBusiness(b: Business) {
    router.push({ pathname: '/review', params: { businessId: b.id, businessName: b.name, businessLogo: b.logo_url ?? '' } })
  }

  return (
    <SafeAreaView style={[styles.container, rtl]}>
      <Text style={[styles.title, isRTL && { textAlign: 'right' }]}>{t('shareAReview')}</Text>
      <Text style={[styles.subtitle, isRTL && { textAlign: 'right' }]}>{t('whichBusiness')}</Text>

      <View style={[styles.searchBox, isRTL && { flexDirection: 'row-reverse' }]}>
        <Search size={18} color="#666" />
        <TextInput
          style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
          placeholder={t('searchBusinessPlaceholder')}
          placeholderTextColor="#555"
          value={search}
          onChangeText={searchBusinesses}
        />
        {loading && <ActivityIndicator size="small" color="#2B8BFF" />}
      </View>

      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {businesses.map(b => (
          <TouchableOpacity key={b.id} style={[styles.businessRow, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => selectBusiness(b)}>
            <BusinessLogo name={b.name} logoUrl={b.logo_url} size={36} />
            <View>
              <Text style={[styles.bizName, isRTL && { textAlign: 'right' }]}>{b.name}</Text>
              <Text style={[styles.bizCat, isRTL && { textAlign: 'right' }]}>{getCategoryLabel(b.category, lang)}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {search.length >= 2 && businesses.length === 0 && !loading && (
          <Text style={[styles.noResults, isRTL && { textAlign: 'right' }]}>{t('noBusinessFound')}</Text>
        )}
        {search.length === 0 && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{t('categoriesHint1')}</Text>
            <Text style={styles.hintText}>{t('categoriesHint2')}</Text>
            <Text style={styles.hintText}>{t('categoriesHint3')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', padding: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 16, marginBottom: 6 },
  subtitle: { color: '#57534e', fontSize: 14, marginBottom: 24 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, gap: 10, borderWidth: 1, borderColor: '#1e2a3a', marginBottom: 16 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  results: { flex: 1 },
  businessRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: '#161b22', marginBottom: 8, borderWidth: 1, borderColor: '#1e2a3a' },
  bizName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bizCat: { color: '#666', fontSize: 12, marginTop: 2 },
  noResults: { color: '#666', textAlign: 'center', marginTop: 32, fontSize: 14 },
  hint: { marginTop: 32, alignItems: 'center', gap: 10 },
  hintText: { color: '#333', fontSize: 13 },
})
