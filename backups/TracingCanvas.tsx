import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
} from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Defs, ClipPath, G } from 'react-native-svg';

export type TracingCanvasRef = {
  clear: () => void;
};

type Props = {
  strokeColor?: string;
  containerStyle?: ViewStyle;
  guidePath?: string;
  strokeWidth?: number;
  initialPaths?: string[];
  currentPath?: string;
  onPathChange?: (paths: string[]) => void;
  onCurrentPathChange?: (path: string) => void;
};

const TracingCanvas = forwardRef<TracingCanvasRef, Props>(
  (
    {
      strokeColor = '#000',
      containerStyle,
      guidePath,
      strokeWidth = 4,
      initialPaths = [],
      currentPath: propCurrentPath = '',
      onPathChange,
      onCurrentPathChange,
    },
    ref
  ) => {
    const paths = useRef<string[]>(initialPaths);
    const currentPath = useRef<string>(propCurrentPath);
    const [_, forceUpdate] = useState({});
    const [layout, setLayout] = useState({ width: 1, height: 1 });

    const VIEWBOX_SIZE = 200;

    const scaleX = layout.width / VIEWBOX_SIZE;
    const scaleY = layout.height / VIEWBOX_SIZE;

    useEffect(() => {
      paths.current = initialPaths;
      currentPath.current = propCurrentPath;
      forceUpdate({});
    }, [initialPaths, propCurrentPath]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        paths.current = [];
        currentPath.current = '';
        onPathChange?.([]);
        onCurrentPathChange?.('');
        forceUpdate({});
      },
    }));

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const x = (locationX / layout.width) * VIEWBOX_SIZE;
          const y = (locationY / layout.height) * VIEWBOX_SIZE;
          currentPath.current = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
          onCurrentPathChange?.(currentPath.current);
          forceUpdate({});
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const x = (locationX / layout.width) * VIEWBOX_SIZE;
          const y = (locationY / layout.height) * VIEWBOX_SIZE;
          currentPath.current += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
          onCurrentPathChange?.(currentPath.current);
          forceUpdate({});
        },
        onPanResponderRelease: () => {
          if (currentPath.current) {
            paths.current.push(currentPath.current);
            currentPath.current = '';
            onPathChange?.([...paths.current]);
            onCurrentPathChange?.('');
          }
          forceUpdate({});
        },
      })
    ).current;

    const handleLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setLayout({ width, height });
    };

    if (!guidePath) return <View style={[styles.container, containerStyle]} />;

    return (
      <View
        style={[styles.container, containerStyle]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <ClipPath id="clip-letter">
              <Path d={guidePath} fill="black" />
            </ClipPath>
          </Defs>

          <Path
            d={guidePath}
            stroke="#ccc"
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <G clipPath="url(#clip-letter)">
            {paths.current.map((d, idx) => (
              <Path
                key={`path-${idx}`}
                d={d}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath.current ? (
              <Path
                d={currentPath.current}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </G>
        </Svg>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TracingCanvas;
