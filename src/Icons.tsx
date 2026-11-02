import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name:
    | "arrow"
    | "refresh"
    | "block"
    | "work"
    | "distance"
    | "supply"
    | "chevron"
    | "external"
    | "copy"
    | "check"
    | "info"
    | "pause"
    | "play";
  size?: number;
  className?: string;
}) {
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17" />
      </>
    ),
    block: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9m-4-16.2 8 4.5" />
      </>
    ),
    work: (
      <>
        <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7" />
      </>
    ),
    distance: (
      <>
        <path d="M4 19h16M6 15l3-6 4 3 5-8M14 4h4v4" />
        <circle cx="6" cy="15" r="1" />
      </>
    ),
    supply: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8.5M12 5.5v13" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    external: (
      <>
        <path d="M14 3h7v7m0-7L11 13" />
        <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.1" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8V4Z" />,
  };
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function Wheel({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 160 170"
      fill="none"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <g stroke="currentColor" strokeWidth="2">
        <circle cx="80" cy="75" r="64" />
        <circle cx="80" cy="75" r="57" />
        <circle cx="80" cy="75" r="9" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <path
            key={angle}
            d="M80 18v48"
            transform={`rotate(${angle} 80 75)`}
          />
        ))}
        <path d="m60 137-10 23h60l-10-23M43 161h74" />
      </g>
      <g fill="currentColor">
        <circle cx="80" cy="75" r="3" />
        <circle cx="80" cy="11" r="3" />
        <circle cx="144" cy="75" r="3" />
        <circle cx="16" cy="75" r="3" />
      </g>
    </svg>
  );
}
