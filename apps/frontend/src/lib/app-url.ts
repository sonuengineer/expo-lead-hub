// Build an absolute URL to a route inside this app, honoring the hosting
// sub-path (Vite `base`, e.g. "/mmrd/"). Use for QR codes, report links, and
// any link the user copies/scans — window.location.origin alone drops the
// sub-path and would 404 on cPanel.
export function appUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, ""); // "" at root, "/mmrd" under a sub-path
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${base}${p}`;
}
