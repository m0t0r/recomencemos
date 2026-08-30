/**
 * Google's "G", inline.
 *
 * **The four hex values below are the one place in this app that names a colour
 * instead of a token, and that is correct rather than a lapse.** `DESIGN.md` says
 * a component names `bg-background` and never a colour value — because a colour
 * value bypasses the layer that makes re-theming possible. This mark is not part
 * of the theme: it is a trademark, its palette belongs to Google, and Google's
 * Sign-In branding guidelines require it reproduced exactly. Tokenising it would
 * mean a re-theme silently recolouring somebody else's logo, which is both wrong
 * and the opposite of what the token layer is for.
 *
 * **Inline rather than an asset**, for three reasons that all matter here: it
 * costs no request on a Worker's mobile connection (NFR3 bounds first-load
 * bytes), it needs no entry in the CSP's `img-src` (runbook §5), and it cannot
 * fail to load and leave a wordless button.
 *
 * **`aria-hidden`**, because the button already says _Entrar con Google_. The
 * logo is recognition, not information, and announcing it twice is noise —
 * `docs/policy/voice.md`'s rule that nothing may refer to meaning carried by
 * colour alone is satisfied by the label doing the work.
 */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={className}
      role="presentation"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
