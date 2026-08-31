// ============================================================
//  T4A — Tuition4All Design System · Color Tokens
//  Theme: Sleek Dark / Indigo-Violet Brand
// ============================================================

export const colors = {
  // ── Brand Core ──────────────────────────────────────────
  primary:        '#6C63FF',   // T4A Indigo (brand primary)
  primaryDark:    '#5B53EE',   // Pressed / hover state
  primaryDeep:    '#4A3FDD',   // Deep pressed
  accent:         '#8B5CF6',   // Purple gradient end
  accentAlt:      '#A78BFA',   // Lighter accent

  // ── Backgrounds ─────────────────────────────────────────
  background:     '#0D0E1A',   // Page / screen background
  surface:        '#13152A',   // Card / panel surface
  surfaceElevated:'#1C1F3A',   // Raised card / modal
  surfaceHigh:    '#252848',   // Highest elevation

  // ── Text ────────────────────────────────────────────────
  text:           '#F0F0FF',   // Primary text
  textSecondary:  '#8B8FA8',   // Secondary / sub-label
  textMuted:      '#555779',   // Placeholder / disabled
  textInverse:    '#0D0E1A',   // Text on light backgrounds

  // ── Borders ─────────────────────────────────────────────
  border:         'rgba(108,99,255,0.25)',  // Default border (indigo tint)
  borderSubtle:   'rgba(255,255,255,0.08)', // Subtle dividers
  borderGlow:     'rgba(108,99,255,0.6)',   // Active / focused border

  // ── Semantic ─────────────────────────────────────────────
  success:        '#10B981',
  successBg:      'rgba(16,185,129,0.15)',
  error:          '#F87171',
  errorBg:        'rgba(248,113,113,0.15)',
  warning:        '#FBBF24',
  warningBg:      'rgba(251,191,36,0.15)',
  info:           '#38BDF8',
  infoBg:         'rgba(56,189,248,0.15)',

  // ── Utilities ───────────────────────────────────────────
  white:          '#FFFFFF',
  black:          '#000000',
  transparent:    'transparent',

  // ── Overlays ─────────────────────────────────────────────
  overlay:        'rgba(0,0,0,0.6)',
  overlayLight:   'rgba(13,14,26,0.8)',
  glassLight:     'rgba(255,255,255,0.05)',
  glassBorder:    'rgba(255,255,255,0.1)',

  // ── Status Badge Colors ──────────────────────────────────
  statusPending:  '#FBBF24',
  statusConfirmed:'#10B981',
  statusCancelled:'#F87171',
  statusCompleted:'#8B5CF6',

  // ── Gradient stops (use as array in LinearGradient) ──────
  gradientPrimary: ['#6C63FF', '#8B5CF6'] as [string, string],
  gradientDark:    ['#0D0E1A', '#1a1040'] as [string, string],
  gradientCard:    ['#1C1F3A', '#13152A'] as [string, string],
  gradientAdmin:   ['#1a1040', '#0D0E1A'] as [string, string],

  // ── Legacy aliases (keep for backward compat) ────────────
  secondary:      '#5B53EE',
};

export type Colors = typeof colors;
