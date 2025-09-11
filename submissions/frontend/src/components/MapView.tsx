"use client";

import React from "react";
import dynamic from "next/dynamic";
import styles from "./MapView.module.scss"; 

export type TrackPoint = { time: string; lat: number; lon: number; event_time: number };

type Props = {
  track: TrackPoint[];
  width?: number | string;
  height?: number;
};
const MapComponent = dynamic(() => import('./MapComponent').then(mod => ({ default: mod.default })), {
    ssr: false,
    loading: () => <div className={styles.loading}>Загрузка карты...</div>
  });

export default function MapView({ track, width = 400, height = 600 }: Props) {
  if (!track.length) {
    return (
      <div className={styles.mapContainer} style={{ width, height }}>
        <div className={styles.noData}>Нет данных трека</div>
      </div>
    );
  }

  return (
    <div className={styles.mapContainer} style={{ width, height }}>
      <div className={styles.mapInfo}>
        <div className={styles.infoItem}>
          <span>Точек:</span> {track.length}
        </div>
        <div className={styles.infoItem}>
          <span>Период:</span> {new Date(track[0].time).toLocaleString()} - {new Date(track[track.length - 1].time).toLocaleString()}
        </div>
      </div>
      
      <MapComponent track={track} />
    </div>
  );
}