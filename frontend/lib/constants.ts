export const SOURCE_LABEL_MAP = {
  requirements: 'Customer Requirements',
  platform: 'Platform / Existing Product',
  regulatory: 'Regulatory Standard',
} as const;

export type SourceDocType = keyof typeof SOURCE_LABEL_MAP;
