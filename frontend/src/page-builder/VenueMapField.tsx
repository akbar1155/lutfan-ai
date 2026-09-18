import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { pageBuilderApi, type GeocodeHit } from "./api";
import { hasMapPoint, parseMapPoint } from "./yandexMap";
import { IconSearch, IconTrash } from "./icons";

const markerIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562]; // Toshkent
const DEFAULT_ZOOM = 12;
const PINNED_ZOOM = 16;

type Props = {
  mapLat?: number | null;
  mapLng?: number | null;
  address?: string;
  language?: string;
  onChange: (point: { mapLat: number | null; mapLng: number | null; address?: string }) => void;
};

export default function VenueMapField({ mapLat, mapLng, address, onChange }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pinned = hasMapPoint(mapLat, mapLng);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: pinned ? [mapLat as number, mapLng as number] : DEFAULT_CENTER,
      zoom: pinned ? PINNED_ZOOM : DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onChangeRef.current({ mapLat: Math.round(lat * 1e6) / 1e6, mapLng: Math.round(lng * 1e6) / 1e6 });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pinned) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    const point: [number, number] = [mapLat as number, mapLng as number];
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { icon: markerIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        onChangeRef.current({ mapLat: Math.round(pos.lat * 1e6) / 1e6, mapLng: Math.round(pos.lng * 1e6) / 1e6 });
      });
    } else {
      markerRef.current.setLatLng(point);
    }
    map.setView(point, Math.max(map.getZoom(), PINNED_ZOOM));
  }, [mapLat, mapLng, pinned]);

  const applyHit = (hit: GeocodeHit, fillAddress: boolean) => {
    onChange({
      mapLat: hit.lat,
      mapLng: hit.lng,
      ...(fillAddress && !(address || "").trim() && hit.address ? { address: hit.address.slice(0, 240) } : {}),
    });
    setHits([]);
    setError("");
  };

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    const parsed = parseMapPoint(text);
    if (parsed) {
      applyHit({ name: text, address: "", lat: parsed.lat, lng: parsed.lng }, false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await pageBuilderApi.geocode(text);
      const list = res.results || [];
      setHits(list);
      if (!list.length) setError(t("pbMapEmpty"));
      if (list.length === 1) applyHit(list[0], true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pbMapEmpty"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-map">
      <span>{t("pbMap")}</span>
      <p className="pb-field-hint">{t("pbMapHint")}</p>
      <div className="pb-map-container">
        <div ref={containerRef} className="pb-map-canvas" />
        <div className="pb-map-search-overlay">
          <div className="pb-map-search">
            <input
              value={query}
              maxLength={240}
              placeholder={t("pbMapPh")}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
            />
            <button
              type="button"
              className="pb-map-search-btn"
              aria-label={t("pbMapSearch")}
              title={t("pbMapSearch")}
              disabled={busy || !query.trim()}
              onClick={() => void search()}
            >
              <IconSearch />
            </button>
          </div>
          {error ? <p className="pb-error">{error}</p> : null}
          {hits.length > 1 ? (
            <ul className="pb-map-hits">
              {hits.map((hit) => (
                <li key={`${hit.lat},${hit.lng},${hit.name}`}>
                  <button type="button" onClick={() => applyHit(hit, true)}>
                    <b>{hit.name}</b>
                    {hit.address ? <small>{hit.address}</small> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {pinned ? (
        <button type="button" className="pb-map-clear" onClick={() => onChange({ mapLat: null, mapLng: null })}>
          <IconTrash />
          {t("pbMapClear")}
        </button>
      ) : null}
    </div>
  );
}
