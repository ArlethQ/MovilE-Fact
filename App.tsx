import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppContent } from './src/components/auth/AuthFlow';
import { BusinessHome } from './src/features/workspace/BusinessHome';

export default function App() {
  return <SafeAreaProvider><AppContent BusinessHome={BusinessHome} /></SafeAreaProvider>;
}
