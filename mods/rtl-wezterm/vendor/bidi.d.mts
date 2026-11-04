// Types for the vendored bidi-js 1.1.0 (the parts the mod uses).
export type EmbeddingLevels = {
  levels: Uint8Array
  paragraphs: { start: number; end: number; level: number }[]
}

export type Bidi = {
  getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevels
  getReorderSegments(text: string, levels: EmbeddingLevels, start?: number, end?: number): [number, number][]
  getMirroredCharacter(char: string): string | null
  getBidiCharTypeName(char: string): string
  openingToClosingBracket(char: string): string | null
  closingToOpeningBracket(char: string): string | null
}

export default function bidiFactory(): Bidi
