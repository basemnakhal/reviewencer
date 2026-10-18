import { ActivityIndicator, View } from 'react-native'

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0D1117', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2B8BFF" size="large" />
    </View>
  )
}
