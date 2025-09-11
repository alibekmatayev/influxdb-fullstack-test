"use client";

import React from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type TrackPoint = { time: string; lat: number; lon: number; event_time: number };

type Props = {
  track: TrackPoint[];
};

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function MapComponent({ track }: Props) {
  const trackCoordinates = track.map(point => [point.lat, point.lon] as [number, number]);
  const centerLat = track.reduce((sum, p) => sum + p.lat, 0) / track.length;
  const centerLon = track.reduce((sum, p) => sum + p.lon, 0) / track.length;

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <Polyline
        positions={trackCoordinates}
        color="#4c8cff"
        weight={3}
        opacity={0.8}
      />
      
      {track[0] && (
        <Marker position={[track[0].lat, track[0].lon]}>
          <Popup>
            <div>
              <strong>СТАРТ</strong><br/>
              Время: {new Date(track[0].time).toLocaleString()}<br/>
              Координаты: {track[0].lat.toFixed(6)}, {track[0].lon.toFixed(6)}
            </div>
          </Popup>
        </Marker>
      )}
      
      {track.length > 1 && track[track.length - 1] && (
        <Marker position={[track[track.length - 1].lat, track[track.length - 1].lon]}>
          <Popup>
            <div>
              <strong>ФИНИШ</strong><br/>
              Время: {new Date(track[track.length - 1].time).toLocaleString()}<br/>
              Координаты: {track[track.length - 1].lat.toFixed(6)}, {track[track.length - 1].lon.toFixed(6)}
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}