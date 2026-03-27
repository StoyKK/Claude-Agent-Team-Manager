import type { FallbackProps } from "react-error-boundary";

/**
 * Reusable fallback UI for React ErrorBoundary wrappers.
 *
 * Uses hardcoded hex colors (not CSS variables) so the fallback renders
 * correctly even if the main stylesheet fails to load.
 *
 * Matches the app's dark theme per D-04 from 03-CONTEXT.md.
 */
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#151b23",
          border: "1px solid #30363d",
          borderRadius: 12,
          padding: "32px 28px 24px",
          color: "#e6edf3",
          textAlign: "center",
        }}
      >
        {/* Error icon */}
        <svg
          width={48}
          height={48}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f85149"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 16 }}
          aria-hidden="true"
        >
          <circle cx={12} cy={12} r={10} />
          <line x1={12} y1={8} x2={12} y2={12} />
          <line x1={12} y1={16} x2={12.01} y2={16} />
        </svg>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: "0 0 12px",
            color: "#e6edf3",
          }}
        >
          Something went wrong
        </h2>

        <pre
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            color: "#8b949e",
            background: "#0d1117",
            padding: "12px 16px",
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 120,
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: "0 0 20px",
          }}
        >
          {error instanceof Error ? error.message : String(error)}
        </pre>

        <button
          onClick={resetErrorBoundary}
          style={{
            background: "#4a9eff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
