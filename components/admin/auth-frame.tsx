import type { ReactNode } from "react";

/**
 * Shared auth scaffolding (DESIGN §4.2–§4.3) — the Offshelf wordmark over a single
 * centered card on the `--bg` canvas, with the brand tagline beneath. Calm and
 * credible: lots of warm space, one lime hairline accent on the card.
 */

export function Brand({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: 7,
          background: "var(--warm-900)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <span
          style={{
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: 3,
            background: "var(--accent)",
          }}
        />
      </span>
      <span
        style={{
          fontWeight: 600,
          fontSize: size * 0.7,
          color: "var(--text-strong)",
          letterSpacing: "-0.01em",
        }}
      >
        Offshelf
      </span>
    </div>
  );
}

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "var(--space-8)",
          }}
        >
          <Brand />
        </div>
        {children}
        <div
          style={{
            textAlign: "center",
            marginTop: "var(--space-6)",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          Commerce for what the big platforms won’t sell.
        </div>
      </div>
    </div>
  );
}
