import { MoodDotMap } from "../../components/MoodDotMap";
import { RssSourceList } from "../../components/RssSourceList";
import { SourceMoodLegend } from "../../components/SourceMoodLegend";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { getLatestPoem, listSources, readRssSources, readSiteSettings, readState } from "../../lib/fileStorage";

export default async function MoodMapPage() {
  const [latest, state, sources, rssSources, settings] = await Promise.all([getLatestPoem(), readState(), listSources(), readRssSources(), readSiteSettings()]);
  const latestSource = sources.at(-1);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      {!settings.showMoodDots ? (
        <section className="empty-state">
          <p>Mood noktaları site ayarlarında kapalı.</p>
        </section>
      ) : latestSource ? (
        <>
          <MoodDotMap source={latestSource} />
          <SourceMoodLegend />
          <RssSourceList collected={latestSource.rss} />
        </>
      ) : (
        <>
          <section className="empty-state">
            <p>Henüz kaynak noktası yok.</p>
          </section>
          <RssSourceList sources={rssSources} />
        </>
      )}
    </main>
  );
}
