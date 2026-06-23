import { ReactNode, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../lib/ThemeContext';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Native bottom sheet matching the web Sheet primitive — handle on top,
 * slide-up with a 320ms cubic-bezier-ish easing, fading scrim, ESC closes
 * on web (no-op on native), tap outside closes. Uses Reanimated for the
 * transform so it runs on the UI thread.
 */
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const { tokens } = useTheme();
  const translateY = useSharedValue(1000);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      translateY.value = withTiming(0, { duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1) });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(1000, { duration: 280, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [open, translateY, opacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Reanimated's `withTiming` callback is on the UI thread — we need
  // `runOnJS` to bubble the unmount back to React. But since `Modal`
  // handles its own mount cycle, we just rely on `visible={open}` and let
  // the animations play their entrance/exit naturally.
  return (
    <Modal transparent visible={open} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => runOnJS(onClose)()} />
        </Animated.View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: tokens.sheet,
              borderTopLeftRadius: tokens.radius.sheet,
              borderTopRightRadius: tokens.radius.sheet,
              paddingHorizontal: 22,
              paddingTop: 10,
              paddingBottom: 30,
            },
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 5,
              borderRadius: 999,
              backgroundColor: tokens.borderStrong,
              marginBottom: 18,
              marginTop: 6,
            }}
          />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
