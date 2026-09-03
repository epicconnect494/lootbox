import { LoginForm } from "@/components/customer/AuthForms";
import { Mono, Panel } from "@/components/ui/primitives";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">Sign in</h1>
        <p className="mt-1 text-sm text-ink-300">Your vault, balance and receipts are tied to your account.</p>
      </header>
      <Panel strong>
        <LoginForm next={next ?? null} />
      </Panel>
      <Panel as="aside" aria-label="Demo credentials" className="text-sm text-ink-300">
        <div className="font-semibold text-ink-100">Demo credentials</div>
        <p className="mt-1">
          Customer: <Mono>customer@demo.lootbox</Mono> / <Mono>demo-password-123</Mono>
        </p>
        <p className="mt-1 text-xs text-ink-400">
          Other seeded accounts use the same password: <Mono>admin@demo.lootbox</Mono>, <Mono>support@demo.lootbox</Mono>, <Mono>catalog@demo.lootbox</Mono>, <Mono>finance@demo.lootbox</Mono>, <Mono>risk@demo.lootbox</Mono>, plus customers <Mono>nova@</Mono>, <Mono>kai@</Mono>, <Mono>sol@</Mono> and an unverified <Mono>fresh@demo.lootbox</Mono>.
        </p>
      </Panel>
    </div>
  );
}
