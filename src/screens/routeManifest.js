export const appRoutes = [
  "/",
  "/welcome",
  "/today",
  "/calm",
  "/sos",
  "/care",
  "/pressure",
  "/check-in",
  "/journal",
  "/reflect",
  "/wisdom",
  "/pause",
  "/journeys",
  "/museum",
  "/me",
  "/timeline"
];

export function isKnownAppRoute(pathname) {
  return appRoutes.includes(pathname) || pathname.startsWith("/journeys/");
}
