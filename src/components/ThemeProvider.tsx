import type { ReactNode } from "react";

import type { SiteTheme } from "../lib/types";

export function ThemeProvider({ children, theme }: { children: ReactNode; theme: SiteTheme }) {
  return (
    <div className="theme-root" data-active-theme={theme}>
      {children}
    </div>
  );
}
