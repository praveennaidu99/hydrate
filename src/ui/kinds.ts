import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { Kind } from '../notifications';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Visual identity of each reminder category: icon + hue. */
export const KIND_UI: Record<Kind, { icon: IconName; color: string }> = {
  water: { icon: 'water', color: '#0EA5E9' },
  food: { icon: 'nutrition', color: '#10B981' },
  medicine: { icon: 'medkit', color: '#8B5CF6' },
  exercise: { icon: 'walk', color: '#F97316' },
  sleep: { icon: 'moon', color: '#6366F1' },
  custom: { icon: 'sparkles', color: '#64748B' },
};
