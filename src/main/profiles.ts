import { DEFAULT_SETTINGS, presetHighQuality, presetLowLatency, presetRecording } from '@shared/settings'
import type { Profile } from '@shared/types'

export function builtInProfiles(): Profile[] {
  return [
    { id: 'everyday', name: 'Everyday', builtIn: true, settings: structuredClone(DEFAULT_SETTINGS) },
    { id: 'low-latency', name: 'Low latency', builtIn: true, settings: presetLowLatency() },
    { id: 'high-quality', name: 'High quality', builtIn: true, settings: presetHighQuality() },
    { id: 'recording', name: 'Recording', builtIn: true, settings: presetRecording() },
  ]
}
