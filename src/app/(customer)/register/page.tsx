import { RegisterForm } from "@/components/customer/AuthForms";
import { Panel } from "@/components/ui/primitives";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">Create account</h1>
        <p className="mt-1 text-sm text-ink-300">Browse odds freely. Opening packs requires age and identity verification in a region where paid opening is enabled.</p>
      </header>
      <Panel strong>
        <RegisterForm next={next ?? null} />
      </Panel>
      <p className="text-center text-xs text-ink-500">Demo environment. Registering does not imply any jurisdiction is legally approved.</p>
    </div>
  );
}
