import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Line } from 'react-native-svg'

export type ThumbValue = 1 | 3 | 5

function IconThumbUp({ stroke }: { stroke: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" stroke={stroke} />
      <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke={stroke} />
    </Svg>
  )
}

function IconNeutralFace({ stroke }: { stroke: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" stroke={stroke} />
      <Line x1="8" y1="15" x2="16" y2="15" stroke={stroke} />
      <Line x1="9" y1="9" x2="9.01" y2="9" stroke={stroke} strokeWidth={3} />
      <Line x1="15" y1="9" x2="15.01" y2="9" stroke={stroke} strokeWidth={3} />
    </Svg>
  )
}

function IconThumbDown({ stroke }: { stroke: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" stroke={stroke} />
      <Path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" stroke={stroke} />
    </Svg>
  )
}

const OPTIONS = [
  { v: 5 as ThumbValue, label: 'Loved it',  activeBg: '#dcfce7', activeBorder: '#22c55e', activeText: '#15803d', activeCircle: '#22c55e', Icon: IconThumbUp },
  { v: 3 as ThumbValue, label: "It's okay", activeBg: '#fef9c3', activeBorder: '#eab308', activeText: '#a16207', activeCircle: '#eab308', Icon: IconNeutralFace },
  { v: 1 as ThumbValue, label: 'Nope',      activeBg: '#fee2e2', activeBorder: '#ef4444', activeText: '#b91c1c', activeCircle: '#ef4444', Icon: IconThumbDown },
]

export function ThumbPicker({ value, onChange }: { value: ThumbValue; onChange: (v: ThumbValue) => void }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map(({ v, label, activeBg, activeBorder, activeText, activeCircle, Icon }) => {
        const active = value === v
        return (
          <TouchableOpacity
            key={v}
            style={[styles.btn, active && { backgroundColor: activeBg, borderColor: activeBorder }]}
            onPress={() => onChange(v)}
            activeOpacity={0.7}
          >
            <View style={[styles.circle, { backgroundColor: active ? activeCircle : '#374151' }]}>
              <Icon stroke={active ? 'white' : '#9ca3af'} />
            </View>
            <Text style={[styles.label, active && { color: activeText, fontWeight: '700' }]}>{label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8,
    borderRadius: 20, borderWidth: 2, borderColor: '#1e2a3a',
    backgroundColor: '#161b22', gap: 10
  },
  circle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center'
  },
  label: { color: '#666', fontSize: 12, fontWeight: '500', textAlign: 'center' },
})
