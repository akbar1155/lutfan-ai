import { useState } from "react";
import { useTranslation } from "react-i18next";
import { pageBuilderApi, type GeocodeHit } from "./api";
import { hasMapPoint, parseMapPoint, yandexWidgetSrc } from "./yandexMap";

type Props = {
  mapLat?: number | null;
  mapLng?: number | null;
  address?: string;
  language?: string;
  onChange: (point: { mapLat: number | null; mapLng: number | null; address?: string }) => void;
};

export default function VenueMapField({ mapLat, mapLng, address, language = "uz-latn", onChange }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pinned = hasMapPoint(mapLat, mapLng);

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
        <button type="button" className="pb-btn" disabled={busy || !query.trim()} onClick={() => void search()}>
          {t("pbMapSearch")}
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
      {pinned ? (
        <>
          <div className="pb-map-preview">
            <iframe
              title={t("pbMap")}
              src={yandexWidgetSrc(mapLat as number, mapLng as number, language)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <button
            type="button"
            className="pb-btn"
            onClick={() => onChange({ mapLat: null, mapLng: null })}
          >
            {t("pbMapClear")}
          </button>
        </>
      ) : null}
    </div>
  );
}
