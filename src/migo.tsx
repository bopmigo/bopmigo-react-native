import React from 'react';
import { View } from 'react-native';

/** Bopmigo's mascot: an orange round friend with two eyes. Drawn with views, so no image or SVG is needed. */
export function Migo({ size = 22, color = '#FF5A1F', look = 'side' }: { size?: number; color?: string; look?: 'side' | 'up' }) {
  const eye = size * 0.2;
  const pupil = eye * 0.42;
  const dy = look === 'up' ? -eye * 0.12 : 0;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <View style={{ position: 'absolute', left: size * 0.06, top: size * 0.04, width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: color }}/>
      <View style={{ position: 'absolute', left: size * 0.08, top: size * 0.12, width: size * 0.86, height: size * 0.86, borderRadius: size, backgroundColor: color }}/>
      {[0.32, 0.58].map(x => (
        <View key={x} style={{ position: 'absolute', left: size * x, top: size * 0.42 + dy, width: eye, height: eye * 1.25, borderRadius: eye, backgroundColor: '#16130F' }}>
          <View style={{ position: 'absolute', right: eye * 0.12, top: eye * 0.16, width: pupil, height: pupil, borderRadius: pupil, backgroundColor: '#FFFFFF' }}/>
        </View>
      ))}
    </View>
  );
}
