export type OcrResult = { text: string; confidence?: number; provider: string };

export interface EvidenceAiProvider {
  extractText(input: { bytes: Uint8Array; mimeType: string }): Promise<OcrResult>;
  summarize(input: { text: string; language?: string }): Promise<{ summary: string; provider: string }>;
}

export function getEvidenceProvider(): EvidenceAiProvider | null {
  // Providers are intentionally opt-in; raw evidence never leaves the system by default.
  return null;
}
