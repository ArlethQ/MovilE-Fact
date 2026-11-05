import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions, type ScaledSize } from 'react-native';

export const RESPONSIVE_BREAKPOINTS = {
  compact: 360,
  tablet: 768,
} as const;

type ResponsiveLayout = ReturnType<typeof createResponsiveLayout>;

const ResponsiveLayoutContext = createContext<ResponsiveLayout | null>(null);

function createResponsiveLayout({ width, height, fontScale, scale }: ScaledSize) {
  const shortestSide = Math.min(width, height);

  return {
    width,
    height,
    fontScale,
    scale,
    isCompact: width < RESPONSIVE_BREAKPOINTS.compact,
    isTablet: shortestSide >= RESPONSIVE_BREAKPOINTS.tablet,
    isLandscape: width > height,
    hasLimitedHeight: height < 700,
    horizontalPadding: width < RESPONSIVE_BREAKPOINTS.compact ? 10 : width < RESPONSIVE_BREAKPOINTS.tablet ? 18 : 28,
  };
}

export function ResponsiveLayoutProvider({ children }: { children: ReactNode }) {
  const dimensions = useWindowDimensions();
  const value = useMemo(
    () => createResponsiveLayout(dimensions),
    [dimensions.fontScale, dimensions.height, dimensions.scale, dimensions.width],
  );

  return createElement(ResponsiveLayoutContext.Provider, { value }, children);
}

export function useResponsiveLayout() {
  const context = useContext(ResponsiveLayoutContext);
  const dimensions = useWindowDimensions();

  return context ?? createResponsiveLayout(dimensions);
}
