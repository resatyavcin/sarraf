"use client"

import * as React from "react"
import { DropdownMenuContent as Content, DropdownMenuItem as Item, DropdownMenuCheckboxItem as CheckboxItem, DropdownMenuRadioItem as RadioItem } from "@/components/ui/dropdown-menu"
import { panelMenuContent, panelMenuItem } from "@/components/booking-link/menu-styles"
import { cn } from "@/lib/utils"

export * from "@/components/ui/dropdown-menu"

export function DropdownMenuContent({ className, ...props }: React.ComponentProps<typeof Content>) {
  return <Content {...props} className={cn(panelMenuContent, className)} />
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Item>) {
  return <Item {...props} className={cn(panelMenuItem, className)} />
}
export function DropdownMenuCheckboxItem({ className, ...props }: React.ComponentProps<typeof CheckboxItem>) {
  return <CheckboxItem {...props} className={cn(className, panelMenuItem, "pl-8")} />
}
export function DropdownMenuRadioItem({ className, ...props }: React.ComponentProps<typeof RadioItem>) {
  return <RadioItem {...props} className={cn(className, panelMenuItem, "pl-8")} />
}
