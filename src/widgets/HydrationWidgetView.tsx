import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WidgetSnapshot } from './widget-sync';

interface WidgetProps {
  data: WidgetSnapshot;
}

/**
 * Cross-platform layout template for the Hydrate Home Screen Widget.
 * Can be rendered for Android RemoteViews preview or shared UI components.
 */
export function HydrationWidgetView({ data }: WidgetProps) {
  const pctPercent = Math.round(data.pct * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💧 Hydrate</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pctPercent}%</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.intakeText}>{data.formattedToday}</Text>
        <Text style={styles.goalText}>of {data.formattedGoal} goal</Text>

        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, pctPercent)}%` }]} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.actionButton}>
          <Text style={styles.actionButtonText}>{data.quickAddLabel} ✅</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F2F4A',
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#EAF2FA',
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#0E8CE8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  progressSection: {
    marginVertical: 4,
  },
  intakeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  goalText: {
    color: '#97AABD',
    fontSize: 12,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CC9FF',
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    backgroundColor: '#0E8CE8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
