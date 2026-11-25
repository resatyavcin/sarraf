import type { ReactNode } from "react"
import { AccountMenu } from "@/components/layout/account-menu"
import type { AccountProfile } from "@/types/account"
export function PanelShell({ children, headerAction, profile }: { children: ReactNode; headerAction?: ReactNode; profile: AccountProfile }) {
 return <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-background"><div className="mx-auto max-w-[834px] pt-3"><header className="mx-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3"><span className="text-lg font-semibold">Sarraf</span><div className="flex flex-wrap items-center gap-2">{headerAction}<AccountMenu profile={profile} /></div></header><main className="dashboard-content">{children}</main></div></div>
}
