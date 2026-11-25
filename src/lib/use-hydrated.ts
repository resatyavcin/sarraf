"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const client = () => true
const server = () => false

/** Switch to browser-stored preferences after the server markup has hydrated. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, client, server)
}
