import { Tabs } from 'expo-router'
import { Home, Search, PlusCircle, User } from 'lucide-react-native'
import { useLanguage } from '../../lib/i18n'

export default function TabsLayout() {
  const { t } = useLanguage()
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a' },
      tabBarActiveTintColor: '#ff2d55',
      tabBarInactiveTintColor: '#666',
    }}>
      <Tabs.Screen name="feed" options={{ title: t('tabFeed'), tabBarIcon: ({ color }) => <Home color={color} size={24} /> }} />
      <Tabs.Screen name="search" options={{ title: t('tabSearch'), tabBarIcon: ({ color }) => <Search color={color} size={24} /> }} />
      <Tabs.Screen name="record" options={{ title: t('tabReview'), tabBarIcon: ({ color }) => <PlusCircle color={color} size={24} /> }} />
      <Tabs.Screen name="me" options={{ title: t('tabMe'), tabBarIcon: ({ color }) => <User color={color} size={24} /> }} />
    </Tabs>
  )
}
