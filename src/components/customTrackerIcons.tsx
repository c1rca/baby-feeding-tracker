/* eslint-disable react-refresh/only-export-components -- serializable icon lookup is shared by renderers. */
import { createElement } from 'react'
import {
  Activity, Apple, Bath, BookOpen, Brush, Clock, CupSoda, Droplet, Dumbbell, Footprints,
  Heart, Leaf, Moon, Music, Pill, Shield, Shirt, Smile, Sparkles, Star, Stethoscope, Sun, Thermometer, Wind,
  type LucideIcon,
} from 'lucide-react'
import { DEFAULT_CUSTOM_ICON } from '../domain/customTrackers'

/**
 * The icons a caregiver may choose from.
 *
 * Keyed by string so a tracker definition stays serialisable and syncs like any
 * other record. An unknown key — a definition written by a newer build, synced
 * to an older one — resolves to the default rather than rendering nothing,
 * because a row with no icon reads as a broken row.
 */
export const CUSTOM_TRACKER_ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles, droplet: Droplet, pill: Pill, sun: Sun,
  moon: Moon, dumbbell: Dumbbell, thermometer: Thermometer, stethoscope: Stethoscope,
  bath: Bath, shirt: Shirt, book: BookOpen, heart: Heart,
  smile: Smile, footprints: Footprints, brush: Brush, wind: Wind,
  apple: Apple, cup: CupSoda, clock: Clock, music: Music,
  leaf: Leaf, star: Star, shield: Shield, activity: Activity,
}

export const customTrackerIcon = (icon: string): LucideIcon =>
  CUSTOM_TRACKER_ICON_MAP[icon] ?? CUSTOM_TRACKER_ICON_MAP[DEFAULT_CUSTOM_ICON]

export function CustomTrackerIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  return createElement(customTrackerIcon(icon), { size })
}
