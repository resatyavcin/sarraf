import type { ReactNode } from "react"
import { AccountMenu } from "@/components/layout/account-menu"
import type { AccountProfile } from "@/types/account"
export function PanelShell({ children, headerAction, profile }: { children: ReactNode; headerAction?: ReactNode; profile: AccountProfile }) {
 return <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-background"><div className="mx-auto max-w-[834px] pt-3"><header className="mx-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b pb-3"><span className="text-lg font-semibold">Sarraf</span><div className="flex min-w-0 items-center justify-end gap-2">{headerAction}<AccountMenu profile={profile} /></div></header><main className="dashboard-content">{children}</main></div></div>
}
