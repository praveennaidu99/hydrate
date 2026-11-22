import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme, ViewStyle } from 'react-native';
import { loadThemeMode, saveThemeMode, ThemeMode } from './storage';

/**
 * "Tide" design tokens.
 * One hero gradient (water), soft surfaces, semantic tones, per-category hues.
 */
const light = {
  bg: '#F4F7FB',
  bgGlow: '#D6ECFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3F9',
  ink: '#0B1B2B',
  inkSoft: '#56687C',
  inkFaint: '#97A6B6',
  line: 'rgba(11,27,43,0.08)',
  accent: '#0E8CE8',
  accentSoft: '#E1F0FD',
  onAccent: '#FFFFFF',
  waterA: '#4CC9FF',
  waterB: '#2563EB',
  success: '#0B9468',
  successSoft: '#DCF4EA',
  warn: '#B9650A',
  warnSoft: '#FCEFD9',
  danger: '#D92D4A',
  dangerSoft: '#FCE3E8',
  tabTint: 'light' as const,
};

export type Colors = Omit<typeof light, 'tabTint'> & { tabTint: 'light' | 'dark' };

const dark: Colors = {
  bg: '#050F18',
  bgGlow: '#0B2C4A',
  surface: '#0C1A26',
  surfaceAlt: '#132331',
  ink: '#EAF2FA',
  inkSoft: '#97AABD',
  inkFaint: '#5D7185',
  line: 'rgba(255,255,255,0.07)',
  accent: '#4CB4FF',
  accentSoft: '#0F2F4A',
  onAccent: '#03121F',
  waterA: '#5DD0FF',
  waterB: '#3B6CF6',
  success: '#34D399',
  successSoft: '#0D2C22',
  warn: '#F5B544',
  warnSoft: '#33260F',
  danger: '#FB7185',
  dangerSoft: '#3A1621',
  tabTint: 'dark',
};

export const F = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 };

interface ThemeCtx {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({ colors: light, isDark: false, mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    loadThemeMode().then(setModeState);
  }, []);

  const value = useMemo<ThemeCtx>(() => {
    const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
    return {
      colors: isDark ? dark : light,
      isDark,
      mode,
      setMode: (m) => {
        setModeState(m);
        saveThemeMode(m);
      },
    };
  }, [mode, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** Build a StyleSheet that depends on the current theme colors. */
export function useStyles<T>(factory: (c: Colors, isDark: boolean) => T): T {
  const { colors, isDark } = useTheme();
  return useMemo(() => factory(colors, isDark), [factory, colors, isDark]);
}

/** Soft elevation in light mode, hairline border in dark mode. */
export const elevation = (c: Colors, isDark: boolean): ViewStyle =>
  isDark
    ? { borderWidth: 1, borderColor: c.line }
    : Platform.select<ViewStyle>({
        ios: { shadowColor: '#0B2540', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
        default: { elevation: 3, shadowColor: '#0B2540' },
      })!;

/** Append an alpha channel to a #RRGGBB color. */
export const alpha = (hex: string, a: number) =>
  hex + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');
