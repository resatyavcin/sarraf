"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const SWIPE_START = 12;
const SWIPE_COMMIT = 56;
const FLICK = 0.11;

function placeTrack(
  el: HTMLDivElement | null,
  page: number,
  pages: number,
  dx: number,
  animate: boolean
) {
  if (!el || pages < 1) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.style.willChange = animate ? "auto" : "transform";
  el.style.transition = !animate || reduce ? "none" : "transform 200ms var(--ease-out)";
  el.style.transform = `translate3d(calc(${-page} * 100% / ${pages} + ${dx}px), 0, 0)`;
}

type Sample = { x: number; t: number };
type Origin = {
  x: number;
  y: number;
  active: boolean;
  horizontal: boolean;
  pointerId: number;
  samples: Sample[];
};

export function SwipeDeck({
  index,
  onIndexChange,
  children,
}: {
  index: number;
  onIndexChange: (index: number) => void;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const origin = useRef<Origin | null>(null);
  const draggingRef = useRef(false);
  const seen = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    placeTrack(trackRef.current, index, count, 0, seen.current);
    seen.current = true;
  }, [index, count]);

  function rubber(dx: number, width: number) {
    const atStart = index <= 0 && dx > 0;
    const atEnd = index >= count - 1 && dx < 0;
    if (!atStart && !atEnd) return dx;
    const dimension = width || 1;
    const constant = 0.55;
    return (dx * dimension * constant) / (dimension + constant * Math.abs(dx));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (origin.current?.active) return;
    if (event.target instanceof Element && event.target.closest("[data-row-swipe]")) return;
    origin.current = {
      x: event.clientX,
      y: event.clientY,
      active: true,
      horizontal: false,
      pointerId: event.pointerId,
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = origin.current;
    if (!start?.active || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dx) < SWIPE_START && Math.abs(dy) < SWIPE_START) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start.active = false;
        return;
      }
      start.horizontal = true;
      draggingRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    start.samples.push({ x: event.clientX, t: event.timeStamp });
    if (start.samples.length > 5) start.samples.shift();
    placeTrack(trackRef.current, index, count, rubber(dx, event.currentTarget.clientWidth), false);
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const start = origin.current;
    if (start && start.pointerId !== event.pointerId) return;
    origin.current = null;
    draggingRef.current = false;
    if (start?.horizontal) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 400);
      const dx = event.clientX - start.x;
      const samples = start.samples;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last && first ? last.t - first.t : 0;
      const velocity = dt > 0 && last && first ? (last.x - first.x) / dt : 0;
      const flickNext = velocity < -FLICK;
      const flickPrev = velocity > FLICK;
      const current = index;
      const pages = count;
      if ((dx <= -SWIPE_COMMIT || flickNext) && current < pages - 1) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        onIndexChange(current + 1);
      } else if ((dx >= SWIPE_COMMIT || flickPrev) && current > 0) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        onIndexChange(current - 1);
      } else {
        placeTrack(trackRef.current, index, count, 0, true);
      }
    }
    setDragging(false);
  }

  return (
    <div
      className={cn("overflow-hidden", dragging && "select-none")}
      style={{ touchAction: "pan-y" }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <div ref={trackRef} className="flex items-start" style={{ width: `${count * 100}%` }}>
        {slides.map((slide, slideIndex) => {
          const hidden = !dragging && slideIndex !== index;
          return (
            <div
              key={slideIndex}
              className={cn("shrink-0 px-4", hidden && "h-0 overflow-hidden")}
              style={{ width: `${100 / count}%` }}
              aria-hidden={hidden}
              inert={hidden || undefined}
            >
              {slide}
            </div>
          );
        })}
      </div>
    </div>
  );
}
