import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { pageBuilderApi } from "./api";
import { presetMusicUrl } from "./config";
import InvitationRenderer from "./InvitationRenderer";
import "./page-builder.css";
import { DEFAULT_DESIGN, type InvitationPagePayload } from "./types";

export default function PublicInteractivePage() {
  const { slug } = useParams();
  const [page, setPage] = useState<InvitationPagePayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    pageBuilderApi
      .publicBySlug(slug)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const src = useMemo(() => {
    if (!page) return "";
    if (page.musicConfig.source === "upload" && page.musicConfig.url) return page.musicConfig.url;
    return presetMusicUrl(page.musicConfig.presetId || "elegant");
  }, [page]);

  const toggleMusic = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const openInvite = async () => {
    setOpened(true);
    if (!audioRef.current && src) {
      audioRef.current = new Audio(src);
      audioRef.current.loop = true;
    }
    try {
      await audioRef.current?.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  if (missing || !slug) {
    return (
      <div className="ip-missing">
        <div>
          <h1>Taklifnoma topilmadi</h1>
          <p>Havola noto‘g‘ri yoki sahifa nashr qilinmagan.</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return <div className="ip-missing">Yuklanmoqda…</div>;
  }

  return (
    <div className="ip-public">
      {!opened ? (
        <div className="ip-open-layer">
          <div className="ip-open-card">
            <p>{page.title || "Taklifnoma"}</p>
            <button type="button" onClick={() => void openInvite()}>
              Taklifnomani ochish
            </button>
          </div>
        </div>
      ) : null}
      <InvitationRenderer
        content={{
          title: page.title,
          mainText: page.mainText,
          date: page.date,
          time: page.time,
          address: page.address,
        }}
        design={page.designConfig || DEFAULT_DESIGN}
        opened={opened}
      />
      {opened ? (
        <button
          type="button"
          className="ip-music-ctl"
          onClick={() => void toggleMusic()}
          aria-label={playing ? "Pauza" : "Ijro"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
      ) : null}
    </div>
  );
}
