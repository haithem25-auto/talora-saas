"use client";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// أيقونة مخصصة باللون الأزرق لـ TALORA لمنع مشاكل الصور في Next.js
const taloraMarkerIcon = L.divIcon({
  className: "custom-talora-marker",
  html: `
    <div style="
      background-color: #2563EB;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="background-color: #0B1F3A; width: 8px; height: 8px; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  className?: string;
}

// مكون لتحديث مركز الخريطة عند تغيير الموقع سلسًا
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function LeafletMap({ center, zoom = 14, className = "" }: LeafletMapProps) {
  return (
    <div className={`w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        scrollWheelZoom={false}
      >
        <RecenterMap center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} icon={taloraMarkerIcon} />
      </MapContainer>
    </div>
  );
}