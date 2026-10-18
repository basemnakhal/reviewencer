import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../constants/Colors'

type Tier = 'reviewer' | 'top_reviewer' | 'reviewencer'
type Variant = 'light' | 'dark'

export function TierBadge({ tier, variant = 'light' }: { tier: Tier; variant?: Variant }) {
  if (tier === 'reviewer') return null

  if (tier === 'reviewencer') {
    return (
      <LinearGradient
        colors={Colors.brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}
      >
        <Text style={styles.filledText}>Reviewencer</Text>
      </LinearGradient>
    )
  }

  const borderColor = variant === 'dark' ? Colors.royal[300] : Colors.royal[600]
  return (
    <View style={[styles.pill, styles.outline, { borderColor }]}>
      <Text style={[styles.outlineText, { color: borderColor }]}>Top Reviewer</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  outline: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  filledText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  outlineText: {
    fontSize: 11,
    fontWeight: '500',
  },
})
