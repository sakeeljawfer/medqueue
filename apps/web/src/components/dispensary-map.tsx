'use client';

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pin = icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export interface MapPoint {
  id: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
}

export default function DispensaryMap({ points }: { points: MapPoint[] }) {
  if (points.length === 0) return null;
  const center: [number, number] = [points[0]!.lat, points[0]!.lng];

  return (
    <div
      className="overflow-hidden border border-line"
      style={{ borderRadius: 'var(--mq-radius)', height: 220 }}
    >
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pin}>
            <Popup>
              {p.name}, {p.town}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
