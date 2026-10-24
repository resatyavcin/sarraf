"use client";

import { useEffect, useState } from "react";

const PIXEL_DELAYS = [90, 180, 270, 0, 90, 180, 90, 180, 270];

export function LoadingStatus() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div role="status" className="flex items-center gap-2.5">
      <span aria-hidden className="grid shrink-0 grid-cols-3 gap-[1.5px]">
        {PIXEL_DELAYS.map((delay, index) => (
          <span
            key={index}
            className="size-1 animate-drive-pixel rounded-[1px] bg-foreground"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="animate-drive-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] bg-clip-text text-[13px] font-medium text-transparent">
        Yükleniyor
      </span>
      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {elapsed.toFixed(1)}s
      </span>
    </div>
  );
}
