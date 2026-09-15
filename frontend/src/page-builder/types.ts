export type DesignConfig = {
  primaryColor: string;
  pattern: string;
  flower: string;
  texture: string;
  frame: string;
  font: string;
  animation: string;
  decorationDensity: string;
};

export type MusicConfig = {
  source: "preset" | "upload";
  presetId: string;
  url: string;
};

export type InvitationPagePayload = {
  id: string;
  slug: string;
  title: string;
  mainText: string;
  date: string;
  time: string;
  address: string;
  designConfig: DesignConfig;
  musicConfig: MusicConfig;
  designPrompt?: string;
  status: "draft" | "published" | "unpublished";
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  description?: string;
  swatch?: string;
  accent?: string;
};

export const DEFAULT_DESIGN: DesignConfig = {
  primaryColor: "ivory",
  pattern: "oriental",
  flower: "rose",
  texture: "premium-paper",
  frame: "gold-ornamental",
  font: "elegant",
  animation: "gentle",
  decorationDensity: "balanced",
};

export const DEFAULT_MUSIC: MusicConfig = {
  source: "preset",
  presetId: "elegant",
  url: "",
};

export const EMPTY_PAGE: Omit<
  InvitationPagePayload,
  "id" | "slug" | "publicUrl" | "createdAt" | "updatedAt"
> = {
  title: "",
  mainText: "",
  date: "",
  time: "",
  address: "",
  designConfig: DEFAULT_DESIGN,
  musicConfig: DEFAULT_MUSIC,
  designPrompt: "",
  status: "draft",
};
