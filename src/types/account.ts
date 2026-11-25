export type AccountProfile = {
  name: string;
  email: string;
  avatar: string | null;
  role: "owner" | "viewer";
};
export type BudgetViewer = { email: string; createdAt: string };
