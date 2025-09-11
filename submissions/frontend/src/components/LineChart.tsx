"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import styles from "./LineChart.module.scss";

export type Point = { time: string; value: number };

type Props = {
  data: Point[];
  width?: number | string;
  height?: number;
  color?: string;
  title?: string;
  yLabel?: string;
  showArea?: boolean;
  showGrid?: boolean;
  maxDataPoints?: number;
  animate?: boolean;
};

const DEFAULT_HEIGHT = 400;
const DEFAULT_COLOR = "#4c8cff";
const DEFAULT_MAX_POINTS = 1000;
const DEBOUNCE_DELAY = 50;
const PADDING = { top: 10, right: 50, bottom: 30, left: 60 };

const calculateExtent = (nums: number[]): readonly [number, number] => {
  if (!nums.length) return [0, 1] as const;
  
  let min = nums[0];
  let max = nums[0];
  
  for (const n of nums) {
    if (n < min) min = n;
    if (n > max) max = n;
  }
  
  if (min === max) {
    const delta = Math.max(1, Math.abs(min)) * 0.1;
    return [min - delta, max + delta] as const;
  }
  
  const padding = (max - min) * 0.05;
  return [min - padding, max + padding] as const;
};

const calculateYExtent = (nums: number[]): readonly [number, number] => {
  if (!nums.length) return [0, 1] as const;
  
  let min = nums[0];
  let max = nums[0];
  
  for (const n of nums) {
    if (n < min) min = n;
    if (n > max) max = n;
  }
  
  if (min === max) {
    const delta = Math.max(1, Math.abs(min)) * 0.1;
    return [Math.max(0, min - delta), max + delta] as const;
  }
  
  const padding = (max - min) * 0.05;

  return [Math.max(0, min - padding), max + padding] as const;
};

const createSmoothPath = (points: { x: number; y: number }[]): string => {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];
    
    if (i === 1) {
      path += ` L ${current.x} ${current.y}`;
    } else {
      const controlX = previous.x + (current.x - previous.x) * 0.5;
      path += ` Q ${controlX} ${previous.y} ${current.x} ${current.y}`;
    }
  }
  
  return path;
};

const createArea = (points: { x: number; y: number }[], bottomY: number): string => {
  if (points.length < 2) return "";
  const path = createSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${path} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
};

const formatTimeLabel = (time: number, timeRange: number): string => {
  const date = new Date(time);
  const timeRangeHours = timeRange / (1000 * 60 * 60);
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  if (timeRangeHours <= 24) {
    return `${hours}:${minutes}`;
  } else if (timeRangeHours <= 168) {
    return `${day}.${month} ${hours}:${minutes}`;
  } else {
    return `${day}.${month}`;
  }
};

const formatYValue = (value: number): string => {
  if (value === 0) {
    return "0";
  }
  
  if (Math.abs(value) < 0.01 || Math.abs(value) > 1000000) {
    return value.toExponential(2);
  }
  
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  return parseFloat(value.toFixed(2)).toString();
};

// Кастомный хук для дебаунса
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface PreparedData {
  path: string;
  area: string;
  yTicks: Array<{ y: number; val: number }>;
  timeTicks: Array<{ x: number; time: number; label: string }>;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  svgWidth: number;
  svgHeight: number;
  pts: Array<{ t: number; v: number; raw: Point }>;
  sx: (x: number) => number;
  sy: (y: number) => number;
}

interface HoverInfo {
  x: number;
  y: number;
  time: number;
  value: number;
  label: string;
}

export default function LineChart({
  data,
  width = "100%",
  height = DEFAULT_HEIGHT,
  color = DEFAULT_COLOR,
  title,
  yLabel,
  showArea = true,
  showGrid = true,
  maxDataPoints = DEFAULT_MAX_POINTS,
  animate = false,
}: Props) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const debouncedHover = useDebounce(hover, DEBOUNCE_DELAY);

  const prepared = useMemo((): PreparedData => {
    if (!data?.length) {
      return {
        path: "",
        area: "",
        yTicks: [],
        timeTicks: [],
        xmin: 0,
        xmax: 1,
        ymin: 0,
        ymax: 1,
        svgWidth: 1000,
        svgHeight: height,
        pts: [],
        sx: () => 0,
        sy: () => 0,
      };
    }

    const filteredData = data.filter(d => d.value >= 0);

    if (!filteredData.length) {
      return {
        path: "",
        area: "",
        yTicks: [],
        timeTicks: [],
        xmin: 0,
        xmax: 1,
        ymin: 0,
        ymax: 1,
        svgWidth: 1000,
        svgHeight: height,
        pts: [],
        sx: () => 0,
        sy: () => 0,
      };
    }


    const optimizedData = filteredData.length > maxDataPoints 
      ? filteredData.filter((_, i) => i % Math.ceil(filteredData.length / maxDataPoints) === 0)
      : filteredData;

    const pts = optimizedData.map((d) => ({
      t: new Date(d.time).getTime(),
      v: d.value,
      raw: d,
    }));

    const xs = pts.map((p) => p.t);
    const ys = pts.map((p) => p.v);
    const [xmin, xmax] = calculateExtent(xs);
    const [ymin, ymax] = calculateYExtent(ys);

    const svgWidth = Math.max(1000, height * 2);
    const svgHeight = height;
    
    const innerWidth = svgWidth - PADDING.left - PADDING.right;
    const innerHeight = svgHeight - PADDING.top - PADDING.bottom;

    const sx = (x: number) => PADDING.left + (xmin === xmax ? 0.5 : (x - xmin) / (xmax - xmin)) * innerWidth;
    const sy = (y: number) => PADDING.top + (ymax === ymin ? 0.5 : (1 - (y - ymin) / (ymax - ymin))) * innerHeight;

    const pathPoints = pts.map(p => ({ x: sx(p.t), y: sy(p.v) }));
    const path = createSmoothPath(pathPoints);
    const area = showArea ? createArea(pathPoints, PADDING.top + innerHeight) : "";

    const yTicks = Array.from({ length: 6 }, (_, i) => {
      const ratio = i / 5;
      const val = ymin + (ymax - ymin) * ratio;
      return { y: sy(val), val };
    });

    const timeRange = xmax - xmin;
    const maxTimeTicks = Math.min(8, Math.floor(innerWidth / 100));
    const numTimeTicks = Math.max(3, maxTimeTicks);
    
    const timeTicks = Array.from({ length: numTimeTicks + 1 }, (_, i) => {
      const ratio = i / numTimeTicks;
      const time = xmin + timeRange * ratio;
      const x = PADDING.left + (innerWidth * ratio);
      const label = formatTimeLabel(time, timeRange);
      
      return { x, time, label };
    });

    return {
      path,
      area,
      yTicks,
      timeTicks,
      xmin,
      xmax,
      ymin,
      ymax,
      svgWidth,
      svgHeight,
      pts,
      sx,
      sy,
    };
  }, [data, height, maxDataPoints, showArea]);

  const findNearestPoint = useCallback((mouseX: number) => {
    if (!prepared.pts.length) return null;
    
    let nearest = prepared.pts[0];
    let minDistance = Math.abs(prepared.sx(nearest.t) - mouseX);
    
    for (const point of prepared.pts) {
      const distance = Math.abs(prepared.sx(point.t) - mouseX);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }
    
    return nearest;
  }, [prepared.pts, prepared.sx]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!prepared.pts.length || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * prepared.svgWidth;
    

    if (svgX < PADDING.left || svgX > prepared.svgWidth - PADDING.right) {
      setHover(null);
      return;
    }
    
    const nearestPoint = findNearestPoint(svgX);
    if (!nearestPoint) return;
    
    const pointX = prepared.sx(nearestPoint.t);
    const pointY = prepared.sy(nearestPoint.v);
    
    setHover({
      x: pointX,
      y: pointY,
      time: nearestPoint.t,
      value: nearestPoint.v,
      label: `${new Date(nearestPoint.t).toLocaleString('ru-RU')} • ${nearestPoint.v.toFixed(2)}${yLabel ? ` ${yLabel}` : ''}`,
    });
  }, [prepared, findNearestPoint, yLabel]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  const gradientId = `areaGrad-${color.replace('#', '')}`;
  const filterId = `glow-${color.replace('#', '')}`;

  return (
    <div className={styles.wrap} style={{ width }}>
      {title && (
        <div className={styles.title}>
          <h3>{title}</h3>
          {yLabel && <span className={styles.yLabel}>{yLabel}</span>}
        </div>
      )}
      
      <svg
        ref={svgRef}
        className={styles.svg}
        width="100%"
        height={height}
        viewBox={`0 0 ${prepared.svgWidth} ${prepared.svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
          
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {showGrid && prepared.yTicks.map((tick, i) => (
          <g key={`y-tick-${i}`}>
            <line 
              x1={PADDING.left} 
              x2={prepared.svgWidth - PADDING.right} 
              y1={tick.y} 
              y2={tick.y} 
              stroke="rgba(255, 255, 255, 0.08)" 
              strokeWidth="1"
            />
            <text 
              x={PADDING.left - 10} 
              y={tick.y} 
              textAnchor="end" 
              dominantBaseline="middle" 
              className={styles.tick}
            >
              {formatYValue(tick.val)}
            </text>
          </g>
        ))}

        {prepared.timeTicks.map((tick, i) => (
          <g key={`time-tick-${i}`}>
            <line 
              x1={tick.x} 
              x2={tick.x} 
              y1={prepared.svgHeight - PADDING.bottom} 
              y2={prepared.svgHeight - PADDING.bottom + 5} 
              stroke="rgba(255, 255, 255, 0.2)" 
              strokeWidth="1"
            />
            <text 
              x={tick.x} 
              y={prepared.svgHeight - PADDING.bottom + 20} 
              textAnchor="middle" 
              className={styles.timeTick}
            >
              {tick.label}
            </text>
          </g>
        ))}

        {showArea && prepared.area && (
          <path 
            d={prepared.area} 
            fill={`url(#${gradientId})`}
            className={animate ? styles.animatedArea : ''}
          />
        )}

        {prepared.path && (
          <path 
            d={prepared.path} 
            fill="none" 
            stroke={color} 
            strokeWidth="1" 
            filter={`url(#${filterId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? styles.animatedPath : ''}
          />
        )}

        {debouncedHover && (
          <>
            <line 
              x1={debouncedHover.x} 
              x2={debouncedHover.x} 
              y1={PADDING.top} 
              y2={prepared.svgHeight - PADDING.bottom} 
              stroke="rgba(255, 255, 255, 0.4)" 
              strokeWidth="0,2"
              strokeDasharray="4,4"
            />

            <line 
              x1={PADDING.left} 
              x2={prepared.svgWidth - PADDING.right} 
              y1={debouncedHover.y} 
              y2={debouncedHover.y} 
              stroke="rgba(255, 255, 255, 0.2)" 
              strokeWidth="0,2"
              strokeDasharray="4,4"
            />
            {/* Точка */}
            <circle 
              cx={debouncedHover.x} 
              cy={debouncedHover.y} 
              r="5" 
              fill="#ffffff" 
              stroke={color} 
              strokeWidth="3"
              className={styles.hoverPoint}
            />
          </>
        )}
      </svg>

      {debouncedHover && (
        <div 
          className={styles.tooltip}
          style={{
            left: `${Math.min(Math.max(10, (debouncedHover.x / prepared.svgWidth) * 100), 90)}%`,
            top: `${Math.max(10, (debouncedHover.y / prepared.svgHeight) * 100 - 10)}%`,
          }}
        >
          {debouncedHover.label}
        </div>
      )}
    </div>
  );
}