"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/**
 * **Mount exactly one of these, and mount it as low as the toasts allow.**
 *
 * One, because `<Toaster />` renders a live region and two live regions on a
 * page are announced twice by a screen reader. Low, because wherever it is
 * mounted, sonner is in the first-load JavaScript of every route below it —
 * which is why it is not in `apps/web/app/layout.tsx` any more (#157): it sat
 * above every route and shipped ~10 KB gzip to `/` and `/privacy`, which have
 * nothing to toast.
 *
 * So the first surface that calls `toast` mounts this in the smallest scope that
 * covers every surface calling it — a route group's layout if two of them share
 * the need, that route's own page if only one does — and the next one to need it
 * checks whether that scope already covers it before adding a second.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

// Re-exported so consumers reach `toast` through the design system rather than
// taking a direct dependency on sonner.
export { toast } from "sonner";
export { Toaster };
