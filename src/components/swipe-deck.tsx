"use client";

import {
  Children,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const SWIPE_START = 12;
const SWIPE_COMMIT = 56;

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
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(0);
  const suppressClick = useRef(false);
  const origin = useRef<{ x: number; y: number; active: boolean; horizontal: boolean } | null>(null);

  function setDrag(value: number) {
    dragRef.current = value;
    setDragX(value);
  }

  function rubber(dx: number) {
    if (index <= 0 && dx > 0) return dx * 0.25;
    if (index >= count - 1 && dx < 0) return dx * 0.25;
    return dx;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY, active: true, horizontal: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = origin.current;
    if (!start?.active) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dx) < SWIPE_START && Math.abs(dy) < SWIPE_START) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start.active = false;
        return;
      }
      start.horizontal = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDrag(rubber(dx));
  }

  function finish() {
    const start = origin.current;
    origin.current = null;
    if (start?.horizontal) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 400);
      const dx = dragRef.current;
      if (
        (dx <= -SWIPE_COMMIT && index < count - 1) ||
        (dx >= SWIPE_COMMIT && index > 0)
      ) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        onIndexChange(dx < 0 ? index + 1 : index - 1);
      }
    }
    setDragging(false);
    setDrag(0);
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
      <div
        className="flex items-start"
        style={{
          width: `${count * 100}%`,
          transform: `translateX(calc(${-index} * 100% / ${count} + ${dragX}px))`,
          transition: dragging ? "none" : "transform 280ms ease",
        }}
      >
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
