import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { builtInProfiles } from './profiles'
import { parseSettings, parseTheme, settingsFromDisk, validateProfileName, validateSettings } from '@shared/settings'
import type { MirrorSettings, Profile, ThemeChoice } from '@shared/types'

export interface PersistedConfig {
  theme: ThemeChoice
  activeProfileId: string
  settings: MirrorSettings
  customScrcpyPath: string | null
}

function configFile(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function profilesFile(): string {
  return path.join(app.getPath('userData'), 'profiles.json')
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
}

export function defaultConfig(): PersistedConfig {
  return {
    theme: 'system',
    activeProfileId: 'everyday',
    settings: structuredClone(settingsFromDisk(null)),
    customScrcpyPath: null,
  }
}

export function readConfig(): PersistedConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(configFile(), 'utf8')) as Record<string, unknown>
    const settings = settingsFromDisk(parsed.settings)
    const custom = typeof parsed.customScrcpyPath === 'string' && parsed.customScrcpyPath.length > 0 ? parsed.customScrcpyPath : null
    const active = typeof parsed.activeProfileId === 'string' ? parsed.activeProfileId : 'everyday'
    return {
      theme: parseTheme(parsed.theme),
      activeProfileId: active,
      settings,
      customScrcpyPath: custom,
    }
  } catch {
    return defaultConfig()
  }
}

export function writeConfig(config: PersistedConfig) {
  writeJson(configFile(), config)
}

export function readUserProfiles(): Profile[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(profilesFile(), 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    const profiles: Profile[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (typeof record.id !== 'string' || !/^user-[a-z0-9-]+$/i.test(record.id)) continue
      if (typeof record.name !== 'string') continue
      const named = validateProfileName(record.name)
      if ('error' in named) continue
      const settings = parseSettings(record.settings)
      if (!settings || validateSettings(settings)) continue
      profiles.push({ id: record.id, name: named.name, builtIn: false, settings })
    }
    return profiles
  } catch {
    return []
  }
}

export function allProfiles(): Profile[] {
  return [...builtInProfiles(), ...readUserProfiles()]
}

export function writeUserProfiles(profiles: Profile[]) {
  writeJson(
    profilesFile(),
    profiles.filter((profile) => !profile.builtIn),
  )
}
