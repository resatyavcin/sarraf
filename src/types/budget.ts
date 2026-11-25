export type BudgetEntry = {
  id: string
  kind: "income" | "expense"
  description: string
  amountCents: number
  date: string
  categoryId?: string
  recurrence?: { endMonth: string; excludedMonths: string[] }
  createdAt: string
  statementMonth?: string
}

export type BudgetCategory = {
  locked?: boolean
  automatic?: boolean
  id: string
  name: string
}

export type BudgetPreferences = {
  categories: BudgetCategory[]
  savings: Record<string, number>
  savingsTargets?: Record<string, number>
}
