"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { X } from "lucide-react"
import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

const DepthContext = React.createContext(0)

export function Sheet({ children, ...props }: React.ComponentProps<typeof Drawer>) {
  const depth = React.useContext(DepthContext)
  const Root = depth > 0 ? DrawerPrimitive.NestedRoot : Drawer
  return (
    <Root {...props} direction="bottom" shouldScaleBackground={depth === 0} setBackgroundColorOnScale={depth === 0}>
      <DepthContext.Provider value={depth + 1}>{children}</DepthContext.Provider>
    </Root>
  )
}

export function SheetContent({ children, className, side = "bottom", showCloseButton = true, contained = false, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  contained?: boolean
  showCloseButton?: boolean
}) {
  const depth = React.useContext(DepthContext)
  const layer = 70 + depth * 2
  return (
    <DrawerPortal>
      <DrawerOverlay className="bg-black/40" style={{ zIndex: layer }} />
      <DrawerPrimitive.Content {...props} data-slot="drawer-content" data-panel-source-side={side} className="fixed inset-x-0 bottom-0 top-10 mt-0 flex h-auto max-h-none flex-col overflow-hidden rounded-t-[10px] bg-background text-foreground outline-none" style={{ ...props.style, zIndex: layer }}>
        <div className={cn("flex min-h-0 flex-1 flex-col rounded-t-[10px] px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]", contained ? "overflow-hidden" : "overflow-y-auto")}>
          <div aria-hidden className={cn("mx-auto h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30", contained ? "mb-3" : "mb-5")} />
          <div className={cn("relative mx-auto flex w-full max-w-md flex-1 flex-col sm:max-w-md", contained ? "min-h-0 overflow-hidden" : "overflow-visible", className)}>
            {children}
            {showCloseButton ? <DrawerPrimitive.Close aria-label="Kapat" className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"><X className="size-4" /></DrawerPrimitive.Close> : null}
          </div>
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} className={cn("mb-5 flex shrink-0 flex-col gap-1 pr-12", className)} />
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title {...props} className={cn("font-display text-lg font-bold tracking-tight", className)} />
}
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description {...props} className={cn("text-sm text-muted-foreground", className)} />
}
