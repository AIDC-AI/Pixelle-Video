'use client';

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { createTranslator, NextIntlClientProvider } from 'next-intl';

import zhCnMessages from '../../messages/zh-CN.json';

export type AppLocale = 'zh-CN';

type Messages = typeof zhCnMessages;
type MessageNamespace = keyof Messages;

interface AppIntlContextValue {
  locale: AppLocale;
  messages: Messages;
  setLocale: (locale: AppLocale) => void;
}

const DEFAULT_LOCALE: AppLocale = 'zh-CN';
const AppIntlContext = createContext<AppIntlContextValue>({
  locale: DEFAULT_LOCALE,
  messages: zhCnMessages,
  setLocale: () => undefined,
});

export function AppIntlProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = DEFAULT_LOCALE;
    document.title = zhCnMessages.brand.browserTitle;
  }, []);

  const value = useMemo<AppIntlContextValue>(
    () => ({
      locale: DEFAULT_LOCALE,
      messages: zhCnMessages,
      setLocale: () => undefined,
    }),
    []
  );

  return (
    <AppIntlContext.Provider value={value}>
      <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={value.messages}>
        {children}
      </NextIntlClientProvider>
    </AppIntlContext.Provider>
  );
}

export function useAppLocale() {
  return useContext(AppIntlContext);
}

export function useAppTranslations(namespace?: MessageNamespace) {
  const { locale, messages } = useContext(AppIntlContext);
  return useMemo(
    () => createTranslator({ locale, messages, namespace }),
    [locale, messages, namespace]
  );
}
