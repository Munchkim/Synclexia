import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { SketchCanvas } from '@terrylinla/react-native-sketch-canvas';

export interface DrawingCanvasRef {
  clear: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef>((_, ref) => {
  const canvasRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    clear: () => {
      canvasRef.current?.clear();
    },
  }));

  return (
    <View style={styles.container}>
      <SketchCanvas
        ref={canvasRef}
        style={styles.canvas}
        strokeColor="#000"
        strokeWidth={4}
      />
    </View>
  );
});

export default DrawingCanvas;

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  canvas: {
    flex: 1,
  },
});
