import { CustomerShell } from "@/components/shell/CustomerShell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
