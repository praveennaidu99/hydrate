import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import {
  type BadgeCategory,
  type BadgeState,
  type BadgeTier,
  getNextStreakBadge,
} from '../badges';
import { F, radius, useTheme } from '../theme';
import { Card, IconTile, Pills, PressableScale, Text } from './primitives';

export const TIER_CONFIG: Record<
  BadgeTier,
  { label: string; fg: string; bg: string; border: string; glow: string }
> = {
  bronze: { label: 'BRONZE', fg: '#D97706', bg: '#FEF3C7', border: '#FDE68A', glow: 'rgba(217, 119, 6, 0.2)' },
  silver: { label: 'SILVER', fg: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', glow: 'rgba(100, 116, 139, 0.2)' },
  gold: { label: 'GOLD', fg: '#F59E0B', bg: '#FEF3C7', border: '#FCD34D', glow: 'rgba(245, 158, 11, 0.25)' },
  platinum: { label: 'PLATINUM', fg: '#06B6D4', bg: '#CFFAFE', border: '#A5F3FC', glow: 'rgba(6, 182, 212, 0.3)' },
};

export function getTierColors(tier: BadgeTier, isDark: boolean) {
  const base = TIER_CONFIG[tier];
  if (!isDark) return base;
  switch (tier) {
    case 'bronze':
      return { ...base, bg: '#3B1A04', border: '#78350F' };
    case 'silver':
      return { ...base, bg: '#1E293B', border: '#334155', fg: '#94A3B8' };
    case 'gold':
      return { ...base, bg: '#451A03', border: '#92400E' };
    case 'platinum':
      return { ...base, bg: '#083344', border: '#155E75' };
  }
}

// ---------------------------------------------------------------- Badge Card Component

export function BadgeCard({
  badge,
  onPress,
}: {
  badge: BadgeState;
  onPress: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const tc = getTierColors(badge.tier, isDark);

  return (
    <PressableScale onPress={onPress} style={{ width: '48.2%', flexGrow: 1 }}>
      <Card
        style={[
          {
            padding: 14,
            borderColor: badge.unlocked ? tc.border : c.line,
            borderWidth: badge.unlocked ? 1.5 : 1,
            opacity: badge.unlocked ? 1 : 0.85,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconTile
            icon={badge.icon}
            color={badge.unlocked ? tc.fg : c.inkFaint}
            size={36}
          />
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: tc.bg,
            }}
          >
            <Text
              variant="overline"
              style={{ color: tc.fg, fontSize: 9.5, letterSpacing: 0.8 }}
            >
              {tc.label}
            </Text>
          </View>
        </View>

        <Text variant="strong" style={{ marginTop: 10, fontSize: 14 }} numberOfLines={1}>
          {badge.title}
        </Text>
        <Text variant="caption" tone="faint" style={{ marginTop: 2, fontSize: 11.5 }} numberOfLines={1}>
          {badge.subtitle}
        </Text>

        {/* Progress or Unlocked Status */}
        <View style={{ marginTop: 12 }}>
          {badge.unlocked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={14} color={c.success} />
              <Text variant="caption" style={{ color: c.success, fontFamily: F.bold, fontSize: 11 }}>
                Unlocked
              </Text>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text variant="caption" tone="faint" style={{ fontSize: 10 }}>
                  Progress
                </Text>
                <Text variant="caption" tone="soft" style={{ fontSize: 10, fontFamily: F.semibold }}>
                  {badge.currentValue >= 1000
                    ? `${(badge.currentValue / 1000).toFixed(1)}k`
                    : badge.currentValue}
                  /{badge.target >= 1000 ? `${(badge.target / 1000).toFixed(0)}k` : badge.target}
                </Text>
              </View>
              <View
                style={{
                  height: 5,
                  borderRadius: radius.pill,
                  backgroundColor: c.surfaceAlt,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.round(badge.progress * 100)}%`,
                    backgroundColor: tc.fg,
                    borderRadius: radius.pill,
                  }}
                />
              </View>
            </View>
          )}
        </View>
      </Card>
    </PressableScale>
  );
}

// ---------------------------------------------------------------- Streak Milestone Highlight Card

export function StreakMilestoneCard({
  currentStreak,
  longestStreak,
  onViewAll,
}: {
  currentStreak: number;
  longestStreak: number;
  onViewAll?: () => void;
}) {
  const { isDark } = useTheme();
  const next = getNextStreakBadge(currentStreak);

  return (
    <Card style={{ padding: 18, backgroundColor: isDark ? '#1C1917' : '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: isDark ? '#451A03' : '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="flame" size={24} color="#F59E0B" />
          </View>
          <View>
            <Text variant="overline" style={{ color: '#D97706' }}>
              Hydration Streak
            </Text>
            <Text variant="headline" style={{ color: isDark ? '#FEF3C7' : '#78350F' }}>
              {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'} Running
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="caption" tone="faint">
            Record
          </Text>
          <Text variant="strong" tone="ink">
            {longestStreak}d
          </Text>
        </View>
      </View>

      {next ? (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(217, 119, 6, 0.12)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text variant="caption" tone="soft">
              Next badge: <Text variant="strong">{next.nextBadge.title}</Text>
            </Text>
            <Text variant="caption" style={{ color: '#D97706', fontFamily: F.bold }}>
              {next.neededDays} {next.neededDays === 1 ? 'day' : 'days'} away
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: isDark ? '#292524' : '#FDE68A', overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((currentStreak / next.nextBadge.target) * 100))}%`,
                backgroundColor: '#F59E0B',
                borderRadius: radius.pill,
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Text variant="caption" style={{ color: '#D97706', fontFamily: F.bold }}>
            🏆 Ultimate Ocean Master streak achieved!
          </Text>
        </View>
      )}

      {onViewAll && (
        <PressableScale onPress={onViewAll} style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <Text variant="caption" tone="accent" style={{ fontFamily: F.bold }}>
            View all badges →
          </Text>
        </PressableScale>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Badge Detail Modal

export function BadgeDetailModal({
  badge,
  onClose,
}: {
  badge: BadgeState | null;
  onClose: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  if (!badge) return null;

  const tc = getTierColors(badge.tier, isDark);

  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        onPress={onClose}
      >
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ width: '100%', maxWidth: 360 }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card style={{ padding: 24, alignItems: 'center', borderColor: tc.border, borderWidth: 1.5 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  backgroundColor: tc.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name={badge.icon} size={38} color={tc.fg} />
              </View>

              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: tc.bg,
                  marginBottom: 8,
                }}
              >
                <Text variant="overline" style={{ color: tc.fg, fontSize: 10.5 }}>
                  {tc.label} ACHIEVEMENT
                </Text>
              </View>

              <Text variant="title" style={{ textAlign: 'center', fontSize: 22, marginTop: 4 }}>
                {badge.title}
              </Text>
              <Text variant="strong" tone="soft" style={{ marginTop: 2 }}>
                {badge.subtitle}
              </Text>

              <Text variant="body" tone="soft" style={{ textAlign: 'center', marginTop: 12, lineHeight: 20 }}>
                {badge.description}
              </Text>

              <View
                style={{
                  width: '100%',
                  marginTop: 20,
                  padding: 14,
                  borderRadius: radius.md,
                  backgroundColor: c.surfaceAlt,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" tone="faint">
                    Status
                  </Text>
                  <Text
                    variant="strong"
                    style={{
                      color: badge.unlocked ? c.success : c.inkSoft,
                    }}
                  >
                    {badge.unlocked
                      ? 'Unlocked ✅'
                      : `${badge.currentValue} / ${badge.target} ${badge.unitSuffix || ''}`}
                  </Text>
                </View>

                {!badge.unlocked && (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.line, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.round(badge.progress * 100)}%`,
                          backgroundColor: tc.fg,
                          borderRadius: radius.pill,
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>

              <PressableScale
                onPress={onClose}
                style={{
                  marginTop: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 32,
                  borderRadius: radius.pill,
                  backgroundColor: c.accent,
                }}
              >
                <Text variant="strong" tone="onAccent">
                  Done
                </Text>
              </PressableScale>
            </Card>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- Main Badge Grid Section

export function BadgeGridSection({
  badges,
  currentStreak,
  longestStreak,
}: {
  badges: BadgeState[];
  currentStreak: number;
  longestStreak: number;
}) {
  const [filter, setFilter] = useState<'all' | BadgeCategory>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const filtered = filter === 'all' ? badges : badges.filter((b) => b.category === filter);

  return (
    <View style={{ gap: 14 }}>
      {/* Streak Highlight Card */}
      <StreakMilestoneCard currentStreak={currentStreak} longestStreak={longestStreak} />

      {/* Filter Chips */}
      <Pills<'all' | BadgeCategory>
        value={filter}
        onChange={setFilter}
        options={[
          { label: `All (${unlockedCount}/${badges.length})`, value: 'all' },
          { label: 'Streaks', value: 'streak', icon: 'flame-outline' },
          { label: 'Volume', value: 'volume', icon: 'water-outline' },
          { label: 'Habits', value: 'habit', icon: 'ribbon-outline' },
        ]}
      />

      {/* Cards 2-Column Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {filtered.map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedBadge(badge);
            }}
          />
        ))}
      </View>

      {/* Detail Modal */}
      <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
    </View>
  );
}
