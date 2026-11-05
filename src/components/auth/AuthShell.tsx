import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { styles } from '../../styles/appStyles';

export function ScreenTransition({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { 
        toValue: 1, 
        duration: reduceMotion ? 0 : 280, 
        easing: Easing.out(Easing.cubic), 
        useNativeDriver: true 
      }),
      Animated.timing(translateY, { 
        toValue: 0, 
        duration: reduceMotion ? 0 : 320, 
        easing: Easing.out(Easing.cubic), 
        useNativeDriver: true 
      }),
    ]).start();
  }, [opacity, reduceMotion, translateY]);

  return (
    <Animated.View style={{ flex: 1, width: '100%', opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export function AuthCard({ children, wide, login, reduceMotion }: { children: ReactNode; wide?: boolean; login?: boolean; reduceMotion: boolean }) {
  return (
    <ScreenTransition reduceMotion={reduceMotion}>
      <View style={[styles.card, login && styles.loginCard, wide && styles.cardWide]}>
        {children}
      </View>
    </ScreenTransition>
  );
}

export function AppLaunchScreen({ reduceMotion }: { reduceMotion: boolean }) {
  const wave = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [progressPercent, setProgressPercent] = useState(reduceMotion ? 100 : 25);

  useEffect(() => {
    if (reduceMotion) {
      wave.setValue(0);
      progress.setValue(1);
      return;
    }

    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    const progressAnimation = Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    waveLoop.start();
    progressAnimation.start();

    // Actualizador periódico seguro sin saturar el JS thread
    const interval = setInterval(() => {
      setProgressPercent((prev) => (prev >= 95 ? 100 : prev + 15));
    }, 300);

    return () => {
      waveLoop.stop();
      progressAnimation.stop();
      clearInterval(interval);
    };
  }, [progress, reduceMotion, wave]);

  const handRotate = wave.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-5deg', '6deg', '-5deg'] });
  const handTranslateY = wave.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, -2, 1] });
  const waveOpacity = wave.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });
  const waveScale = wave.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] });
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['10%', '100%'] });

  return (
    <SafeAreaView style={[{ flex: 1, width: '100%', backgroundColor: '#001A33' }, styles.launchScreen]}>
      <View style={styles.launchOrbTop} />
      <View style={styles.launchOrbTopRight} />
      <View style={styles.launchOrbBottom} />
      
      <View style={styles.launchHeaderBrand}>
        <Image source={require('../../../assets/logo-numerica.png')} style={styles.launchLogoImage} resizeMode="contain" />
        <Text style={styles.launchBrandText}>NUMÉRICA SOFTWARE</Text>
      </View>

      <View style={styles.launchContent}>
        <View style={styles.launchRobotWrap}>
          <Animated.Image source={require('../../../assets/numi-standing.png')} style={styles.launchRobotImage} resizeMode="contain" />
          <Animated.Image source={require('../../../assets/numi-wave-hand.png')} style={[styles.launchWaveHandImage, { transform: [{ translateY: handTranslateY }, { rotate: handRotate }] }]} resizeMode="contain" />
          <Animated.View style={[styles.launchWaveSignal, styles.launchWaveSignalOne, { opacity: waveOpacity, transform: [{ scale: waveScale }] }]} />
          <Animated.View style={[styles.launchWaveSignal, styles.launchWaveSignalTwo, { opacity: waveOpacity, transform: [{ scale: waveScale }] }]} />
          <Animated.Text style={[styles.launchWaveText, { opacity: waveOpacity, transform: [{ scale: waveScale }] }]}>Hola</Animated.Text>
        </View>

        <View style={styles.launchTextBlock}>
          <Text style={styles.launchEyebrow}>Hola, soy Numi</Text>
          <Text style={styles.launchTitle}>Te damos la bienvenida</Text>
          <Text style={styles.launchSubtitle}>Preparando tu espacio de facturación móvil</Text>
        </View>

        <View style={styles.launchProgressTrack}>
          <Animated.View style={[styles.launchProgressFill, { width: progressWidth }]} />
          <Text style={styles.launchProgressText}>{progressPercent}%</Text>
        </View>

        <Text style={styles.launchStatusText}>Preparando todo...</Text>

        <View style={styles.launchFeatures}>
          <View style={styles.launchFeatureItem}>
            <MaterialCommunityIcons name="shield-check-outline" size={27} color="#36E4FF" />
            <Text style={styles.launchFeatureText}>Seguro</Text>
          </View>
          <View style={styles.launchFeatureDivider} />
          <View style={styles.launchFeatureItem}>
            <MaterialCommunityIcons name="lightning-bolt-outline" size={27} color="#36E4FF" />
            <Text style={styles.launchFeatureText}>Rápido</Text>
          </View>
          <View style={styles.launchFeatureDivider} />
          <View style={styles.launchFeatureItem}>
            <MaterialCommunityIcons name="cog-outline" size={27} color="#36E4FF" />
            <Text style={styles.launchFeatureText}>Fácil</Text>
          </View>
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
