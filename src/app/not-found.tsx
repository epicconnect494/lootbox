import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-3xl font-extrabold">Nothing in this slot</h1>
      <p className="text-ink-400">The page you asked for does not exist.</p>
      <Link href="/" className="tap inline-flex items-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 font-semibold text-ink-950">
        Back to Discover
      </Link>
    </main>
  );
}
