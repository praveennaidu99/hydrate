/**
 * Fluid volume conversion and formatting utilities (ml vs. fl oz).
 * Internal storage is always in millilitres (ml) for consistent analytics and scheduling.
 */

export type VolumeUnit = 'ml' | 'oz';

export const ML_PER_OZ = 29.5735;

/** Convert millilitres to US fluid ounces. */
export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

/** Convert US fluid ounces to millilitres. */
export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_OZ);
}

/** Formats a volume in ml to the target unit display string. */
export function formatVolume(
  ml: number,
  unit: VolumeUnit,
  options: { includeUnit?: boolean; compact?: boolean } = {},
): string {
  const { includeUnit = true, compact = false } = options;

  if (unit === 'oz') {
    const oz = mlToOz(ml);
    // If integer, show integer; otherwise 1 decimal place (e.g. 8.5)
    const formatted = oz >= 10 ? Math.round(oz).toString() : (Math.round(oz * 10) / 10).toFixed(oz % 1 === 0 ? 0 : 1);
    return includeUnit ? `${formatted} fl oz` : formatted;
  }

  // Unit is 'ml'
  if (compact && ml >= 1000) {
    const l = +(ml / 1000).toFixed(2);
    return includeUnit ? `${l} L` : l.toString();
  }

  const formatted = Math.round(ml).toLocaleString();
  return includeUnit ? `${formatted} ml` : formatted;
}

/** Unit label for UI display. */
export function unitLabel(unit: VolumeUnit, short = false): string {
  if (unit === 'oz') return short ? 'oz' : 'fl oz';
  return 'ml';
}

/** Standard quick-drink volume options based on unit. */
export const DEFAULT_QUICK_AMOUNTS_ML: [number, number, number] = [150, 250, 500];
export const DEFAULT_QUICK_AMOUNTS_OZ: [number, number, number] = [5, 8, 16]; // approx in fl oz
