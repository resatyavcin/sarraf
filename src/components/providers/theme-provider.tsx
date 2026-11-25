"use client"

import { useHydrated } from "@/lib/use-hydrated"

import * as React from "react"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (theme: Theme | string) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "randevu-theme"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

function writeCache(storageKey: string, theme: Theme) {
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    /* ignore write failures (private mode) */
  }
}

function readCache(storageKey: string): Theme | null {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === "light" || stored === "dark" ? stored : null
  } catch {
    return null
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = STORAGE_KEY,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  /** Kept for call-site compatibility with the old next-themes provider */
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}) {
  const hydrated = useHydrated()
  const [choice, setThemeState] = React.useState<Theme>()
  const theme = choice ?? (hydrated ? readCache(storageKey) : null) ?? defaultTheme

  React.useEffect(() => {
    if (hydrated) applyTheme(theme)
  }, [hydrated, theme])

  const setTheme = React.useCallback(
    (value: Theme | string) => {
      const next: Theme = value === "light" || value === "LIGHT" ? "light" : "dark"
      setThemeState(next)
      writeCache(storageKey, next)
      applyTheme(next)
    },
    [storageKey]
  )

  const value = React.useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme }),
    [theme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return ctx
}
