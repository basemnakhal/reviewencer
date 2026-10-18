import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import { LanguageProvider } from '../lib/i18n'
import { supabase } from '../lib/supabase'

async function routeByProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).single()
  router.replace(data ? '/tabs/feed' : '/auth/onboarding')
}

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth/phone'); return }
      routeByProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/auth/phone')
      else if (event === 'SIGNED_IN' && session) routeByProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </LanguageProvider>
  )
}
