import type { EncounterRuntime } from '../machines/encounter'

// Scene modules are imported on demand so Phaser (and its ~1MB) only
// loads when an encounter actually starts. Add a case per encounter id
// in lib/game/content/encounters.
export const loadEncounterRuntime = async (encounterId: string): Promise<EncounterRuntime> => {
  switch (encounterId) {
    case 'signal-lock':
      return (await import('./signal-lock')).runtime
    default:
      throw new Error(`No scene for encounter "${encounterId}"`)
  }
}
