// ============================================================
//  T4A — Typography Scale
// ============================================================

export const typography = {
  // Font sizes
  size: {
    xs:   10,
    sm:   12,
    md:   14,
    base: 16,
    lg:   18,
    xl:   20,
    '2xl':22,
    '3xl':26,
    '4xl':32,
    '5xl':40,
  },
  // Font weights (RN uses string)
  weight: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },
  // Line heights
  lineHeight: {
    tight:  18,
    snug:   20,
    normal: 22,
    relaxed:26,
    loose:  32,
  },
  // Letter spacing
  tracking: {
    tight:  -0.5,
    normal: 0,
    wide:   0.5,
    wider:  0.8,
    widest: 1.2,
  },
};
