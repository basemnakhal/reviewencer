import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useContext, useEffect, useState } from 'react'
import strings, { type Lang, type TKey } from './translations'

export type ContentLang = 'en' | 'ar' | 'both'

type LangContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey) => string
  isRTL: boolean
  contentLang: ContentLang
  setContentLang: (l: ContentLang) => void
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: k => strings.en[k],
  isRTL: false,
  contentLang: 'both',
  setContentLang: () => {},
})

const LANG_KEY = 'reviewencer_lang'
const CONTENT_LANG_KEY = 'reviewencer_content_lang'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [contentLang, setContentLangState] = useState<ContentLang>('both')

  useEffect(() => {
    AsyncStorage.multiGet([LANG_KEY, CONTENT_LANG_KEY]).then(pairs => {
      const langVal = pairs[0][1]
      const contentVal = pairs[1][1]
      if (langVal === 'en' || langVal === 'ar') setLangState(langVal)
      if (contentVal === 'en' || contentVal === 'ar' || contentVal === 'both') setContentLangState(contentVal)
    })
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    AsyncStorage.setItem(LANG_KEY, l)
  }

  function setContentLang(l: ContentLang) {
    setContentLangState(l)
    AsyncStorage.setItem(CONTENT_LANG_KEY, l)
  }

  return (
    <LangContext.Provider value={{
      lang,
      setLang,
      t: (key: TKey) => strings[lang][key],
      isRTL: lang === 'ar',
      contentLang,
      setContentLang,
    }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LangContext)
}
