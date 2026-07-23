import type { Metadata } from "next";

import { AnatomyExplorer } from "../../components/anatomy/AnatomyExplorer";
import { readAnatomyGraphBundle } from "../../lib/anatomyGraphServer";

export const metadata: Metadata = {
  title: "UCU BEDEN Anatomy",
  description: "Read-only scanner graph for UCU BEDEN system anatomy."
};

export default async function AnatomyPage() {
  const { bundle, issues } = await readAnatomyGraphBundle();
  return <AnatomyExplorer bundle={bundle} issues={issues} />;
}
