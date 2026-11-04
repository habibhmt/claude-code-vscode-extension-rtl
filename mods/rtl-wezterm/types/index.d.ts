// The mod's contract with Claude Code: the values it keeps in the session (`$.state`).
// Self-contained, as the contract must be; src/recap.ts declares the same shape (RecapCounts).

declare module 'claude-code' {
  interface PluginState {
    rtl: {
      // the recap band's counts, kept across a reload of the mod
      recap: { session: string; prompts: number; promptsAtRecap: number; recaps: number }
    }
  }
}
