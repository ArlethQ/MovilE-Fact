import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppContent } from './src/components/auth/AuthFlow';
import { BusinessHome } from './src/features/workspace/BusinessHome';
import { ResponsiveLayoutProvider } from './src/hooks/useResponsiveLayout';

export default function App() {
  return (
    <SafeAreaProvider>
      <ResponsiveLayoutProvider>
        <AppContent BusinessHome={BusinessHome} />
      </ResponsiveLayoutProvider>
    </SafeAreaProvider>
  );
}
