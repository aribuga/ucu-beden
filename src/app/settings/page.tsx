import { RssSourceList } from "../../components/RssSourceList";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { getLatestPoem, readRssSources, readSiteSettings, readState, readWorld } from "../../lib/fileStorage";

export default async function SettingsPage() {
  const [latest, state, world, settings, rssSources] = await Promise.all([getLatestPoem(), readState(), readWorld(), readSiteSettings(), readRssSources()]);
  const route = world.walking_routes[0];

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <section className="section">
        <h2 className="section-title">Dünya</h2>
        <div className="label-list">
          <div className="label-row">
            <span className="label">ev</span>
            <span>
              {world.home.city}, {world.home.district}, {world.home.building}; {world.home.size_m2} m2 {world.home.apartment_type}.
            </span>
          </div>
          <div className="label-row">
            <span className="label">salon</span>
            <span>{world.home.rooms.living_room.objects.join(", ")}</span>
          </div>
          <div className="label-row">
            <span className="label">yatak odası</span>
            <span>{world.home.rooms.bedroom.objects.join(", ")}</span>
          </div>
          <div className="label-row">
            <span className="label">rota</span>
            <span>{route ? `${route.name}: ${route.segments.join(" / ")}` : "Rota yok."}</span>
          </div>
        </div>
      </section>
      <section className="section">
        <h2 className="section-title">Tema</h2>
        <div className="label-list">
          <div className="label-row">
            <span className="label">aktif</span>
            <span>{settings.theme}</span>
          </div>
          <div className="label-row">
            <span className="label">mood dots</span>
            <span>{settings.showMoodDots ? "açık" : "kapalı"}</span>
          </div>
        </div>
      </section>
      <section className="section">
        <h2 className="section-title">Komutlar</h2>
        <p><span className="command">npm run analyze:input</span></p>
        <p><span className="command">npm run generate:today</span></p>
        <p><span className="command">npm run rebuild:memory</span></p>
      </section>
      <RssSourceList sources={rssSources} />
    </main>
  );
}
