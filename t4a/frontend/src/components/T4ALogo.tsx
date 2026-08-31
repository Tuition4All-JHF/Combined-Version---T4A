/**
 * T4A Logo Component
 * Matches the official Tuition4All brand:
 *   - Logo mark: pure image (logo_transparent.png), no tint
 *   - "Tuition" in bold: dark (#1A1A2E) on light BG, white on dark BG
 *   - "4All" in brand purple (#6B4EFF) always
 */
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface T4ALogoProps {
  variant?: 'full' | 'mark' | 'wordmark';
  /** 'dark' = white "Tuition" text (for dark backgrounds), 'light'/'colored' = black "Tuition" text */
  theme?: 'light' | 'dark' | 'colored';
  scale?: number;
}

const T4ALogo: React.FC<T4ALogoProps> = ({
  variant = 'full',
  theme = 'colored',
  scale = 1,
}) => {
  const markSize = 36 * scale;
  // "Tuition" text: white on dark background, near-black on light
  const tuitionColor = theme === 'dark' ? '#FFFFFF' : '#1A1A2E';
  // "4All" text: always brand purple – visible on both themes
  const allColor = '#6B4EFF';
  const fontSize = 20 * scale;
  const fontWeight = '800' as const;

  const renderMark = () => (
    <Image
      source={require('../../assets/logo_transparent.png')}
      style={{ width: markSize, height: markSize, resizeMode: 'contain' }}
    />
  );

  if (variant === 'mark') {
    return renderMark();
  }

  const wordmark = (
    <View style={styles.wordmarkRow}>
      <Text style={[styles.wordmarkBase, { color: tuitionColor, fontSize, fontWeight }]}>
        Tuition
      </Text>
      <Text style={[styles.wordmarkAccent, { color: allColor, fontSize, fontWeight }]}>
        4All
      </Text>
    </View>
  );

  if (variant === 'wordmark') {
    return wordmark;
  }

  // Full: mark + wordmark side by side
  return (
    <View style={styles.fullRow}>
      {renderMark()}
      <View style={{ marginLeft: 8 * scale }}>
        {wordmark}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmarkBase: {
    letterSpacing: -0.3,
  },
  wordmarkAccent: {
    letterSpacing: -0.3,
  },
});

export default T4ALogo;
