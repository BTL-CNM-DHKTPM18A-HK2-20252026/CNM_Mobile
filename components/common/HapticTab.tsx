import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0.72)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 42,
      bounciness: 9,
    }).start();
  };

  const playRipple = () => {
    rippleScale.setValue(0.72);
    rippleOpacity.setValue(0.28);

    Animated.parallel([
      Animated.spring(rippleScale, {
        toValue: 1.08,
        useNativeDriver: true,
        speed: 22,
        bounciness: 2,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <PlatformPressable
      {...props}
      style={[props.style, styles.tabButton]}
      onPressIn={(ev) => {
        playRipple();
        animateTo(0.88);
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        animateTo(1);
        props.onPressOut?.(ev);
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            opacity: rippleOpacity,
            transform: [{ scale: rippleScale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        {props.children}
      </Animated.View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 56,
  },
  ripple: {
    position: 'absolute',
    alignSelf: 'center',
    top: 3,
    width: 88,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#94A3B8',
  },
});
