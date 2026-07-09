import { createFileRoute, redirect } from "@tanstack/react-router";

// The check-in ritual now lives at the top of the Insights page —
// this route stays only so old links and bookmarks keep working.
export const Route = createFileRoute("/_app/checkin")({
  beforeLoad: () => {
    throw redirect({ to: "/insights" });
  },
});
