/** Extracted design system from an imported page */
export interface DesignSystem {
  colors: ColorToken[];
  fontSizes: FontSizeToken[];
  fontFamilies: FontFamilyToken[];
  typographyStyles: TypographyStyle[];
  spacingScale: number[];
  borderRadii: RadiusToken[];
}

export interface ColorToken {
  value: string;       // Hex color
  count: number;       // How many times it appears
  category: 'text' | 'background' | 'border' | 'other';
  name?: string;       // Auto-generated name like "Primary Blue"
}

export interface FontSizeToken {
  value: string;       // e.g. "16px"
  px: number;          // Numeric value in px
  count: number;
  role?: string;       // "body", "h1", "caption", etc.
}

export interface FontFamilyToken {
  value: string;       // Full font-family string
  shortName: string;   // First font name only
  count: number;
  role?: string;       // "heading", "body", "mono"
}

export interface TypographyStyle {
  id: string;
  name: string;        // e.g. "Heading 1", "Body", "Caption"
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  count: number;       // How many elements use this exact combo
}

export interface RadiusToken {
  value: string;
  count: number;
}
