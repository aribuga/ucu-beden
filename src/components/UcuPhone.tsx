"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type PhoneGalleryItem = {
  id: string;
  date: string;
  type: "poem" | "dream";
  title: string;
  imagePath: string;
  altText: string;
};

export type PhoneNote = {
  date: string;
  title: string;
  text: string;
  moodSentence: string;
};

export type PhoneWeather = {
  summary: string;
  temperature: number | null;
  humidity: number | null;
  wind: number | null;
  bodyEffect: string;
};

export type PhoneMemory = {
  headline: string;
  detail: string;
  traceCount: number;
  recalledCount: number;
  suppressedCount: number;
  dreamReturnCount: number;
  indirectCount: number;
};

export type UcuPhoneData = {
  date: string | null;
  ageDisplay: string;
  dayCount: number;
  moodSentence: string | null;
  gallery: PhoneGalleryItem[];
  notes: PhoneNote[];
  weather: PhoneWeather | null;
  memory: PhoneMemory;
};

type PhoneApp = "home" | "gallery" | "notes" | "weather" | "memory" | "contacts" | "messages";

const APP_INFO: Array<{ id: Exclude<PhoneApp, "home">; label: string; glyph: string; tone: string }> = [
  { id: "gallery", label: "Galeri", glyph: "IMG", tone: "magenta" },
  { id: "notes", label: "Notlar", glyph: "TXT", tone: "yellow" },
  { id: "weather", label: "Hava", glyph: "WX", tone: "cyan" },
  { id: "memory", label: "Hafıza", glyph: "MEM", tone: "green" },
  { id: "contacts", label: "Rehber", glyph: "CNT", tone: "violet" },
  { id: "messages", label: "Mesajlar", glyph: "MSG", tone: "orange" }
];

const APP_TITLES: Record<PhoneApp, string> = {
  home: "UCU BEDEN",
  gallery: "Galeri",
  notes: "Notlar",
  weather: "Hava",
  memory: "Hafıza",
  contacts: "Rehber",
  messages: "Mesajlar"
};

function displayDate(value: string | null): string {
  if (!value) return "tarih yok";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

export function UcuPhone({ data }: { data: UcuPhoneData }) {
  const [isLocked, setIsLocked] = useState(true);
  const [activeApp, setActiveApp] = useState<PhoneApp>("home");
  const [selectedImageId, setSelectedImageId] = useState<string | null>(data.gallery[0]?.id ?? null);
  const [selectedNoteDate, setSelectedNoteDate] = useState<string | null>(data.notes[0]?.date ?? null);
  const [clock, setClock] = useState("--:--");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    const update = () =>
      setClock(new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedImage = useMemo(
    () => data.gallery.find((item) => item.id === selectedImageId) ?? data.gallery[0] ?? null,
    [data.gallery, selectedImageId]
  );
  const selectedNote = useMemo(
    () => data.notes.find((note) => note.date === selectedNoteDate) ?? data.notes[0] ?? null,
    [data.notes, selectedNoteDate]
  );

  function openApp(app: PhoneApp) {
    setActiveApp(app);
  }

  return (
    <section className="ucu-phone-experience" aria-label="UCU BEDEN telefonu">
      <div className="ucu-phone-device">
        <div className="ucu-phone-screen">
          {isLocked ? (
            <button
              type="button"
              className="ucu-phone-lock-screen"
              onClick={() => {
                setIsLocked(false);
                openApp("home");
              }}
              aria-label="Telefonun kilidini aç"
            >
              <img src={`${basePath}/assets/phone-lock-wallpaper.png`} alt="" aria-hidden="true" />
              <span className="ucu-phone-lock-overlay" aria-hidden="true" />
              <span className="ucu-phone-lock-status">
                <b>UCU BEDEN</b>
                <span>{displayDate(data.date)}</span>
              </span>
              <span className="ucu-phone-lock-content">
                <strong>{clock}</strong>
                <span>{data.ageDisplay}</span>
                <em>{data.notes[0]?.title ?? data.moodSentence ?? data.memory.headline}</em>
              </span>
              <span className="ucu-phone-unlock-hint">dokunarak aç</span>
            </button>
          ) : (
            <>
              <div className="ucu-phone-screen-noise" aria-hidden="true" />
              <header className="ucu-phone-status">
                <button type="button" className="ucu-phone-brand" onClick={() => openApp("home")} aria-label="Ana ekrana dön">
                  UCU BEDEN
                </button>
                <span>{activeApp === "home" ? data.ageDisplay : APP_TITLES[activeApp]}</span>
                <span className="ucu-phone-clock">{displayDate(data.date)} · {clock}</span>
              </header>

              <div className="ucu-phone-workspace">
                {activeApp === "home" ? (
                  <HomeScreen data={data} openApp={openApp} />
                ) : (
                  <PhoneAppShell title={APP_TITLES[activeApp]} onBack={() => openApp("home")}>
                    {activeApp === "gallery" ? (
                      <GalleryApp
                        items={data.gallery}
                        selected={selectedImage}
                        onSelect={setSelectedImageId}
                        basePath={basePath}
                      />
                    ) : null}
                    {activeApp === "notes" ? (
                      <NotesApp notes={data.notes} selected={selectedNote} onSelect={setSelectedNoteDate} />
                    ) : null}
                    {activeApp === "weather" ? <WeatherApp weather={data.weather} moodSentence={data.moodSentence} /> : null}
                    {activeApp === "memory" ? <MemoryApp memory={data.memory} /> : null}
                    {activeApp === "contacts" ? <EmptyApp label="Henüz kayıt yok." detail="UCU BEDEN kimseyi tanımıyor." /> : null}
                    {activeApp === "messages" ? <EmptyApp label="Gelen kutusu boş." detail="Henüz bir konuşma başlamadı." /> : null}
                  </PhoneAppShell>
                )}
              </div>

              <footer className="ucu-phone-softkeys" aria-label="Telefon kısayolları">
                <button type="button" onClick={() => openApp("home")}>ana ekran</button>
                <span>{data.dayCount} gün açık</span>
                <button
                  type="button"
                  onClick={() => activeApp === "home" ? setIsLocked(true) : openApp("home")}
                >
                  {activeApp === "home" ? "kilitle" : "kapat"}
                </button>
              </footer>
            </>
          )}
          <div className="ucu-phone-crt-layer" aria-hidden="true" />
          <div
            className="ucu-phone-glass-layer"
            style={{ backgroundImage: `url(${basePath}/assets/phone-glass.png)` }}
            aria-hidden="true"
          />
        </div>
        <img className="ucu-phone-frame" src={`${basePath}/assets/phone-frame.png`} alt="" aria-hidden="true" />
      </div>
      <p className="ucu-phone-caption">UCU BEDEN kişisel cihazı · ekran canlıdır</p>
    </section>
  );
}

function HomeScreen({ data, openApp }: { data: UcuPhoneData; openApp: (app: PhoneApp) => void }) {
  return (
    <div className="ucu-phone-home">
      <div className="ucu-phone-home-note">
        <span>bugünkü iç durum</span>
        <strong>{data.moodSentence ?? data.memory.headline}</strong>
      </div>
      <div className="ucu-phone-app-grid">
        {APP_INFO.map((app) => (
          <button key={app.id} type="button" className={`ucu-phone-app-icon is-${app.tone}`} onClick={() => openApp(app.id)}>
            <span className="ucu-phone-app-glyph" aria-hidden="true">{app.glyph}</span>
            <span>{app.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PhoneAppShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="ucu-phone-app">
      <div className="ucu-phone-app-heading">
        <button type="button" onClick={onBack} aria-label="Ana ekrana dön">←</button>
        <h2>{title}</h2>
      </div>
      <div className="ucu-phone-app-body">{children}</div>
    </section>
  );
}

function GalleryApp({
  items,
  selected,
  onSelect,
  basePath
}: {
  items: PhoneGalleryItem[];
  selected: PhoneGalleryItem | null;
  onSelect: (id: string) => void;
  basePath: string;
}) {
  if (items.length === 0) return <EmptyApp label="Galeri boş." detail="Henüz kaydedilmiş bir görsel yok." />;
  return (
    <div className="ucu-phone-gallery-layout">
      <div className="ucu-phone-gallery-grid">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selected?.id === item.id ? "is-selected" : ""}
            onClick={() => onSelect(item.id)}
            aria-label={`${item.title} görselini aç`}
          >
            <img src={`${basePath}${item.imagePath}`} alt="" />
            <span>{item.type === "dream" ? "rüya" : "şiir"} · {item.date}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <figure className="ucu-phone-gallery-preview">
          <img src={`${basePath}${selected.imagePath}`} alt={selected.altText} />
          <figcaption>{selected.title}</figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function NotesApp({
  notes,
  selected,
  onSelect
}: {
  notes: PhoneNote[];
  selected: PhoneNote | null;
  onSelect: (date: string) => void;
}) {
  if (notes.length === 0) return <EmptyApp label="Not yok." detail="Henüz kaydedilmiş bir şiir yok." />;
  return (
    <div className="ucu-phone-notes-layout">
      <div className="ucu-phone-note-list">
        {notes.map((note) => (
          <button
            type="button"
            key={note.date}
            className={selected?.date === note.date ? "is-selected" : ""}
            onClick={() => onSelect(note.date)}
          >
            <strong>{note.title}</strong>
            <span>{note.date}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <article className="ucu-phone-note-reader">
          <span>{selected.date}</span>
          <h3>{selected.title}</h3>
          <p>{selected.text}</p>
        </article>
      ) : null}
    </div>
  );
}

function WeatherApp({ weather, moodSentence }: { weather: PhoneWeather | null; moodSentence: string | null }) {
  if (!weather) return <EmptyApp label="Hava verisi yok." detail="Dışarısı henüz cihaza ulaşmadı." />;
  return (
    <div className="ucu-phone-weather">
      <div className="ucu-phone-weather-orbit" aria-hidden="true"><span /></div>
      <div>
        <span className="ucu-phone-kicker">dışarı açıklığı</span>
        <h3>{weather.summary}</h3>
        <dl>
          {weather.temperature !== null ? <><dt>sıcaklık</dt><dd>{weather.temperature}°</dd></> : null}
          {weather.humidity !== null ? <><dt>nem</dt><dd>%{weather.humidity}</dd></> : null}
          {weather.wind !== null ? <><dt>rüzgâr</dt><dd>{weather.wind} km/s</dd></> : null}
        </dl>
        {weather.bodyEffect ? <p>{weather.bodyEffect}</p> : moodSentence ? <p>{moodSentence}</p> : null}
      </div>
    </div>
  );
}

function MemoryApp({ memory }: { memory: PhoneMemory }) {
  return (
    <div className="ucu-phone-memory">
      <div className="ucu-phone-memory-signal" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <span className="ucu-phone-kicker">hafıza havası</span>
      <h3>{memory.headline}</h3>
      <p>{memory.detail}</p>
      <dl>
        <div><dt>iz</dt><dd>{memory.traceCount}</dd></div>
        <div><dt>çağrılan</dt><dd>{memory.recalledCount}</dd></div>
        <div><dt>bastırılan</dt><dd>{memory.suppressedCount}</dd></div>
        <div><dt>rüyadan dönen</dt><dd>{memory.dreamReturnCount}</dd></div>
        <div><dt>dolaylı</dt><dd>{memory.indirectCount}</dd></div>
      </dl>
      <nav aria-label="Hafıza bağlantıları">
        <Link href="/memory">rapor</Link>
        <Link href="/memory-map">harita</Link>
        <Link href="/memory/mutations">mutasyonlar</Link>
      </nav>
    </div>
  );
}

function EmptyApp({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="ucu-phone-empty">
      <span aria-hidden="true">· · ·</span>
      <strong>{label}</strong>
      <p>{detail}</p>
    </div>
  );
}
