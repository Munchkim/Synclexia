import * as Haptics from 'expo-haptics';
import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { View, StyleSheet, ViewStyle, PanResponder } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

export type TracingCanvasRef = {
  clear: () => void;
  undo: () => void;
  getPaths: () => string[];
};

type Point = { x: number; y: number };

type Props = {
  strokeColor?: string;
  containerStyle?: ViewStyle;
  guidePaths?: string[] | Point[][];
  strokeWidth?: number;
  onPathChange?: (paths: string[]) => void;
  onStrokeComplete?: (stroke: string) => void;
  showGuide?: boolean;
  glyphScale?: number;
};

const VIEWBOX = 400;
const GUIDE_COLOR = '#E6EBF3';
const GUIDE_EXTRA = 10;
const START_COLOR = '#FFC06A';
const START_STROKE = '#FF9800';
const CURSOR_COLOR = '#FFFFFF';

type Cmd = { type: 'M' | 'L' | 'Q' | 'C'; coords: number[] };
const isFiniteNum = (n: unknown) => Number.isFinite(n as number);

const parsePathCommands = (d: string): Cmd[] => {
  const out: Cmd[] = [];
  const re = /([MLQC])([^MLQC]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(d ?? ''))) !== null) {
    const type = m[1].toUpperCase() as Cmd['type'];
    const raw = (m[2] || '')
      .trim()
      .split(/[\s,]+/)
      .map(v => parseFloat(v))
      .filter(isFiniteNum);
    const size = type === 'Q' ? 4 : type === 'C' ? 6 : 2;
    const coords: number[] = [];
    for (let i = 0; i + size - 1 < raw.length; i += size) {
      const seg = raw.slice(i, i + size);
      if (seg.every(isFiniteNum)) coords.push(...seg);
    }
    if (coords.length) out.push({ type, coords });
  }
  return out;
};

const scaleCommands = (cmds: Cmd[], scale: number): Cmd[] => {
  if (!scale || scale === 1) return cmds;
  const cx = VIEWBOX / 2, cy = VIEWBOX / 2;
  return cmds.map(c => ({
    type: c.type,
    coords: c.coords.map((v, i) => {
      const isX = i % 2 === 0;
      const centered = v - (isX ? cx : cy);
      return centered * scale + (isX ? cx : cy);
    }),
  }));
};

const normalizeCommands = (cmds: Cmd[]): Cmd[] => cmds;

const commandsToPath = (cmds: Cmd[]) => {
  if (!cmds.length) return '';
  const parts: string[] = [];
  cmds.forEach(c => {
    const nums = c.coords
      .map(n => (isFiniteNum(n) ? (n as number).toFixed(2) : ''))
      .filter(Boolean);
    if (nums.length) parts.push(`${c.type} ${nums.join(' ')}`);
  });
  const d = parts.join(' ');
  return /NaN/i.test(d) ? '' : d;
};

const samplePointsFromCommands = (cmds: Cmd[], samplesPerSeg = 50): Point[] => {
  const pts: Point[] = [];
  let cx = 0, cy = 0;
  for (const c of cmds) {
    if (c.type === 'M') {
      for (let i = 0; i + 1 < c.coords.length; i += 2) {
        cx = c.coords[i]; cy = c.coords[i + 1];
        if (isFiniteNum(cx) && isFiniteNum(cy)) pts.push({ x: cx, y: cy });
      }
    } else if (c.type === 'L') {
      for (let i = 0; i + 1 < c.coords.length; i += 2) {
        const x = c.coords[i], y = c.coords[i + 1];
        if (isFiniteNum(x) && isFiniteNum(y)) { pts.push({ x, y }); cx = x; cy = y; }
      }
    } else if (c.type === 'Q') {
      for (let i = 0; i + 3 < c.coords.length; i += 4) {
        const cpx = c.coords[i], cpy = c.coords[i + 1];
        const x = c.coords[i + 2], y = c.coords[i + 3];
        if (![cpx, cpy, x, y].every(isFiniteNum)) continue;
        for (let j = 0; j <= samplesPerSeg; j++) {
          const t = j / samplesPerSeg, omt = 1 - t;
          const xt = omt*omt*cx + 2*omt*t*cpx + t*t*x;
          const yt = omt*omt*cy + 2*omt*t*cpy + t*t*y;
          pts.push({ x: xt, y: yt });
        }
        cx = x; cy = y;
      }
    } else if (c.type === 'C') {
      for (let i = 0; i + 5 < c.coords.length; i += 6) {
        const cx1 = c.coords[i], cy1 = c.coords[i + 1];
        const cx2 = c.coords[i + 2], cy2 = c.coords[i + 3];
        const x = c.coords[i + 4], y = c.coords[i + 5];
        if (![cx1, cy1, cx2, cy2, x, y].every(isFiniteNum)) continue;
        const S = samplesPerSeg + 4;
        for (let j = 0; j <= S; j++) {
          const t = j / S, omt = 1 - t;
          const xt = omt*omt*omt*cx + 3*omt*omt*t*cx1 + 3*omt*t*t*cx2 + t*t*t*x;
          const yt = omt*omt*omt*cy + 3*omt*omt*t*cy1 + 3*omt*t*t*cy2 + t*t*t*y;
          pts.push({ x: xt, y: yt });
        }
        cx = x; cy = y;
      }
    }
  }
  return pts;
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const TracingCanvas = forwardRef<TracingCanvasRef, Props>(({
  strokeColor = '#2AA6C9',
  containerStyle,
  guidePaths = [],
  strokeWidth = 12,
  onPathChange,
  onStrokeComplete,
  showGuide = true,
  glyphScale = 1.2,
}, ref) => {
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });

  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => (t + 1) & 0xffff), []);

  const toPx = useCallback(
    (v: number) => {
      const s = Math.max(1, Math.min(canvasSize.width, canvasSize.height));
      return (v / VIEWBOX) * s;
    },
    [canvasSize]
  );
  const START_THRESHOLD = toPx(200);
  const TRACK_THRESHOLD = toPx(200);
  const BACK_TOLERANCE  = toPx(100);

  const dPerStroke = useRef<string[]>([]);
  const samplesPerStroke = useRef<Point[][]>([]);
  const cumulativeLenPerStroke = useRef<number[][]>([]);
  const totalLenPerStroke = useRef<number[]>([]);

  const strokeIdxRef = useRef(0);
  const progressLenRef = useRef(0);
  const revealedPathsRef = useRef<string[]>([]);
  const armedRef = useRef(false);

  useEffect(() => {
    const raw = Array.isArray(guidePaths) && guidePaths.length ? guidePaths : ['M 100 100 L 200 200'];
    const asStrings: string[] =
      typeof raw[0] === 'string'
        ? (raw as string[])
        : (raw as Point[][]).map(stk => {
            if (!stk || stk.length < 2) return '';
            const parts = [`M ${stk[0].x} ${stk[0].y}`];
            for (let i = 1; i < stk.length; i++) parts.push(`L ${stk[i].x} ${stk[i].y}`);
            return parts.join(' ');
          }).filter(Boolean);

    const cmdsPerStroke = asStrings.map(s => scaleCommands(normalizeCommands(parsePathCommands(s)), glyphScale));
    dPerStroke.current = cmdsPerStroke.map(commandsToPath);
    samplesPerStroke.current = cmdsPerStroke.map(cmds => samplePointsFromCommands(cmds, 50));
    cumulativeLenPerStroke.current = samplesPerStroke.current.map(pts => {
      const acc: number[] = [0];
      for (let i = 1; i < pts.length; i++) acc[i] = acc[i - 1] + dist(pts[i - 1], pts[i]);
      return acc;
    });
    totalLenPerStroke.current = cumulativeLenPerStroke.current.map(a => a[a.length - 1] || 0);

    strokeIdxRef.current = 0;
    progressLenRef.current = 0;
    revealedPathsRef.current = [];
    armedRef.current = false;
    onPathChange?.([]);
    bump(); // ensure a paint with new paths
  }, [guidePaths, glyphScale, onPathChange, bump]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      strokeIdxRef.current = 0;
      progressLenRef.current = 0;
      revealedPathsRef.current = [];
      armedRef.current = false;
      onPathChange?.([]);
      bump();
    },
    undo: () => {
      if (revealedPathsRef.current.length > 0) {
        revealedPathsRef.current.pop();
        onPathChange?.(revealedPathsRef.current.slice());
      }
      strokeIdxRef.current = Math.max(0, revealedPathsRef.current.length);
      progressLenRef.current = 0;
      armedRef.current = false;
      bump();
    },
    getPaths: () => revealedPathsRef.current.slice(),
  }));

  const screenToSVG = useCallback((x: number, y: number) => {
    const w = Math.max(1, canvasSize.width);
    const h = Math.max(1, canvasSize.height);
    return { x: (x / w) * VIEWBOX, y: (y / h) * VIEWBOX };
  }, [canvasSize]);

  const pickClosestOnCurrent = (p: Point) => {
    const idx = strokeIdxRef.current;
    const pts = samplesPerStroke.current[idx] || [];
    if (!pts.length) return { ok: false, length: 0, pt: { x: 0, y: 0 } };
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = dist(pts[i], p);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    if (bestD > TRACK_THRESHOLD) return { ok: false, length: 0, pt: pts[0] };
    const length = cumulativeLenPerStroke.current[idx][bestI] || 0;
    return { ok: true, length, pt: pts[bestI], i: bestI };
  };

  const partialPathForCurrent = (): string => {
    const idx = strokeIdxRef.current;
    const pts = samplesPerStroke.current[idx] || [];
    if (pts.length === 0) return '';
    const acc = cumulativeLenPerStroke.current[idx] || [];
    const target = progressLenRef.current;
    let j = 0;
    while (j + 1 < acc.length && acc[j + 1] <= target) j++;
    const segs: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
    for (let i = 1; i <= j; i++) segs.push(`L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`);
    return segs.join(' ');
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const p = screenToSVG(locationX, locationY);
        const idx = strokeIdxRef.current;
        const pts = samplesPerStroke.current[idx] || [];
        if (!pts.length) return;

        const start = pts[0];
        if (dist(p, start) <= START_THRESHOLD) {
          armedRef.current = true;
          progressLenRef.current = 0;
          Haptics.selectionAsync().catch(() => {});
        } else {
          armedRef.current = false;
        }
        bump();
      },

      onPanResponderMove: (evt) => {
        if (!armedRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const p = screenToSVG(locationX, locationY);
        const res = pickClosestOnCurrent(p);
        if (!res.ok) return;
        const curr = progressLenRef.current;
        if (res.length >= curr - BACK_TOLERANCE) {
          progressLenRef.current = Math.max(curr, res.length);
          bump();
        }
      },

      onPanResponderRelease: () => {
        const idx = strokeIdxRef.current;
        const total = totalLenPerStroke.current[idx] || 0;
        if (total === 0) { armedRef.current = false; return; }

        if (armedRef.current && progressLenRef.current >= total * 0.985) {
          const d = dPerStroke.current[idx] || '';
          revealedPathsRef.current = [...revealedPathsRef.current, d];
          onPathChange?.(revealedPathsRef.current.slice());
          onStrokeComplete?.(d);
          strokeIdxRef.current = idx + 1;
          progressLenRef.current = 0;
          Haptics.selectionAsync().catch(() => {});
        }
        armedRef.current = false;
        bump();
      },

      onPanResponderTerminate: () => {
        progressLenRef.current = Math.max(0, progressLenRef.current);
        armedRef.current = false;
        bump();
      },
    })
  ).current;

  const handleLayout = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setCanvasSize({ width, height });
  }, []);

  const currentIdx = strokeIdxRef.current;
  const currentTotal = totalLenPerStroke.current[currentIdx] || 0;
  const dashOffset = Math.max(0, currentTotal - progressLenRef.current);
  const pts = samplesPerStroke.current[currentIdx] || [];
  const startPt = pts[0] || { x: VIEWBOX / 2, y: VIEWBOX / 2 };
  let cursorPt = startPt;
  if (pts.length > 1) {
    const arr = cumulativeLenPerStroke.current[currentIdx] || [0];
    let j = 0;
    while (j + 1 < arr.length && arr[j + 1] <= progressLenRef.current) j++;
    cursorPt = pts[j] || startPt;
  }

  const revealW = Math.max(6, (strokeWidth || 10) * (glyphScale ? (0.9 + (glyphScale - 1) * 0.7) : 1));
  const guideW  = Math.max(2, revealW + GUIDE_EXTRA);
  const partialD = partialPathForCurrent();

  return (
    <View collapsable={false} style={[styles.container, containerStyle]} onLayout={handleLayout}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} style={StyleSheet.absoluteFillObject}>
        {showGuide && (
          <G>
            {dPerStroke.current.map((d, i) =>
              d ? (
                <Path
                  key={`g-${i}`}
                  d={d}
                  stroke={GUIDE_COLOR}
                  strokeWidth={guideW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null
            )}
          </G>
        )}

        {revealedPathsRef.current.map((d, i) =>
          d ? (
            <Path
              key={`r-done-${i}`}
              d={d}
              stroke={strokeColor}
              strokeWidth={revealW}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null
        )}

        {dPerStroke.current[currentIdx] ? (
          <Path
            key="r-active"
            d={dPerStroke.current[currentIdx]}
            stroke={strokeColor}
            strokeWidth={revealW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[currentTotal, currentTotal]}
            strokeDashoffset={dashOffset}
          />
        ) : null}

        {partialD ? (
          <Path
            key="r-partial"
            d={partialD}
            stroke={strokeColor}
            strokeWidth={revealW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}

        {dPerStroke.current[currentIdx] ? (
          <>
            <Circle cx={startPt.x} cy={startPt.y} r={14} fill={START_COLOR} stroke={START_STROKE} strokeWidth={3} />
            <Circle cx={cursorPt.x} cy={cursorPt.y} r={9} fill={CURSOR_COLOR} stroke={strokeColor} strokeWidth={3} />
          </>
        ) : null}
      </Svg>

      <View {...pan.panHandlers} pointerEvents="box-only" style={StyleSheet.absoluteFill} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0,
    minHeight: 150,
    width: '100%',
    height: 400,
  },
});

TracingCanvas.displayName = 'TracingCanvas';
export default TracingCanvas;
