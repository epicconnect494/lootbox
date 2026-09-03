import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell, History, LifeBuoy, ShieldAlert, ShieldCheck, Timer, UserRound, Wallet } from "lucide-react";
import { ExclusionPanel } from "@/components/account/ExclusionPanel";
import { LimitsForm } from "@/components/account/LimitsForm";
import { NotificationsPanel } from "@/components/account/NotificationsPanel";
import { ProfileForm } from "@/components/account/ProfileForm";
import type { AccountOverview } from "@/components/account/types";
import { VerificationPanel } from "@/components/account/VerificationPanel";
import { WalletPanel } from "@/components/account/WalletPanel";
import { accountLinkForReason } from "@/components/events/json-types";
import { Badge, Panel, cx } from "@/components/ui/primitives";
import { listUserOpenings } from "@/domain/openings";
import { accountOverview } from "@/domain/users";
import { fmtDate, moneyStr, tierLabel } from "@/lib/format";
import { json, viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

const NAV = [
  ["profile", "Profile", UserRound],
  ["verification", "Verification", ShieldCheck],
  ["wallet", "Wallet", Wallet],
  ["history", "History", History],
  ["notifications", "Notifications", Bell],
  ["limits", "Limits", Timer],
  ["cooling-off", "Cooling-off", ShieldAlert],
  ["support", "Support", LifeBuoy],
] as const;

const GATE_LABEL: Record<string, string> = { open: "Open packs", battle: "Battles", sellback: "Sell-back", raffle: "Raffles (free entry)" };

type IconType = React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

function Section({ id, title, icon: Icon, sub, children }: { id: string; title: string; icon: IconType; sub?: string; children: React.ReactNode }) {
  return (
    <Panel as="section" id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-cyan-300" aria-hidden />
        <h2 id={`${id}-title`} className="font-display text-lg font-bold md:text-xl">
          {title}
        </h2>
      </div>
      {sub && <p className="-mt-2 mb-4 text-sm text-ink-400">{sub}</p>}
      {children}
    </Panel>
  );
}

export default async function AccountPage() {
  const { db, session, userId } = await viewer();
  if (!session || !userId) redirect("/login?next=/account");
  const overview = json(await accountOverview(db, userId)) as unknown as AccountOverview;
  const openings = await listUserOpenings(db, userId, 50);
  const unread = overview.notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold md:text-3xl">Account</h1>
          <p className="mt-1 text-sm text-ink-400">
            {overview.user.displayName} · member since {fmtDate(overview.user.createdAt, { dateStyle: "medium" })} · <Badge tone={overview.user.status === "ACTIVE" ? "lime" : "danger"}>{overview.user.status.toLowerCase()}</Badge>
          </p>
        </div>
      </div>

      <nav aria-label="Account sections" className="glass flex gap-1 overflow-x-auto p-1">
        {NAV.map(([id, label, Icon]) => (
          <a key={id} href={`#${id}`} className="tap inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-300 hover:bg-white/5 hover:text-ink-100">
            <Icon size={14} aria-hidden /> {label}
            {id === "notifications" && unread > 0 && <span className="rounded-full bg-cyan-400/20 px-1.5 text-[10px] text-cyan-300">{unread}</span>}
          </a>
        ))}
      </nav>

      <Panel as="section" aria-labelledby="elig-title" strong>
        <h2 id="elig-title" className="font-display mb-3 text-lg font-bold">
          Eligibility
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(overview.gates).map(([key, g]) => (
            <div key={key} className={cx("rounded-xl border p-3", g.ok ? "border-lime-400/40 bg-lime-400/5" : "border-white/10")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{GATE_LABEL[key] ?? key}</span>
                <Badge tone={g.ok ? "lime" : "amber"}>{g.ok ? "eligible" : "blocked"}</Badge>
              </div>
              {!g.ok && (
                <ul className="mt-2 space-y-1 text-xs text-ink-300">
                  {g.reasons.map((r) => (
                    <li key={r.code}>
                      <Link href={accountLinkForReason(r.code)} className="hover:underline">
                        {r.message}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-500">Gates depend on your region, age and identity verification, responsible-play limits and exclusions. They never affect odds. No jurisdiction is legally approved by default.</p>
      </Panel>

      <Section id="profile" title="Profile" icon={UserRound}>
        <ProfileForm user={overview.user} jurisdictions={overview.jurisdictions} />
      </Section>

      <Section id="verification" title="Verification" icon={ShieldCheck} sub="Documents are encrypted at rest and reviewed by the verification provider.">
        <VerificationPanel verifications={overview.verifications} />
      </Section>

      <Section id="wallet" title="Wallet" icon={Wallet}>
        <WalletPanel balance={overview.balance} payments={overview.payments} />
      </Section>

      <Section id="history" title="Opening history" icon={History} sub="Every opening carries a signed fairness receipt.">
        {openings.length === 0 ? (
          <p className="text-sm text-ink-400">
            No openings yet.{" "}
            <Link href="/packs" className="text-cyan-300 hover:underline">
              Browse packs
            </Link>
            .
          </p>
        ) : (
          <div className="table-wrap rounded-xl border border-white/8">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Pack</th>
                  <th scope="col">Result</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Ref. value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {openings.map((r) => (
                  <tr key={r.o.id}>
                    <td className="text-ink-400">{fmtDate(r.o.createdAt)}</td>
                    <td>
                      <Link href={`/packs/${r.packSlug}`} className="hover:underline">
                        {r.packName}
                      </Link>
                      {r.o.source !== "DIRECT" && <span className="ml-1 text-xs text-ink-500">({r.o.source.toLowerCase()})</span>}
                    </td>
                    <td>
                      {r.outcomeLabel} <Badge tone="neutral">{tierLabel(r.tier)}</Badge>
                    </td>
                    <td className="font-mono">{moneyStr(r.o.priceMinor, r.o.currency)}</td>
                    <td className="font-mono">{moneyStr(r.o.referenceValueMinor, r.o.currency)}</td>
                    <td>
                      <Badge tone={r.o.status === "SETTLED" ? "neutral" : "danger"}>{r.o.status.toLowerCase()}</Badge>
                    </td>
                    <td>
                      <Link href={`/openings/${r.o.id}`} className="text-cyan-300 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="notifications" title="Notifications" icon={Bell}>
        <NotificationsPanel notifications={overview.notifications} />
      </Section>

      <Section id="limits" title="Responsible-play limits" icon={Timer}>
        <LimitsForm limits={overview.limits} />
      </Section>

      <Section id="cooling-off" title="Cooling-off & self-exclusion" icon={ShieldAlert} sub="Take a break at any time. Both options sign you out everywhere and apply immediately.">
        <ExclusionPanel exclusions={overview.exclusions} />
      </Section>

      <Section id="support" title="Support" icon={LifeBuoy}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-ink-300">
            <p>
              Questions about an opening, a battle result, shipping or a payment? Reply with the reference id shown on the relevant page and we will trace it through the audit log.
            </p>
            <ul className="space-y-1">
              <li>
                Email: <a href="mailto:support@lootbox.example" className="text-cyan-300 hover:underline">support@lootbox.example</a>
              </li>
              <li>
                <Link href="/fairness" className="text-cyan-300 hover:underline">
                  Verify any result yourself
                </Link>
              </li>
              <li>
                <Link href="/vault" className="text-cyan-300 hover:underline">
                  Shipping & sell-back from your vault
                </Link>
              </li>
              <li>
                <a href="#cooling-off" className="text-cyan-300 hover:underline">
                  Responsible-play tools
                </a>
              </li>
            </ul>
            <p className="text-xs text-ink-500">If you feel your play is becoming a problem, independent help is available through your local gambling-support organisation. This platform does not claim legal approval in any jurisdiction.</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-200">Active sessions</h3>
            <div className="table-wrap rounded-xl border border-white/8">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Session</th>
                    <th scope="col">Started</th>
                    <th scope="col">Last seen</th>
                    <th scope="col">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">
                        {s.id.slice(0, 8)}
                        {s.id === session.id && <Badge tone="cyan" className="ml-2">this device</Badge>}
                      </td>
                      <td className="text-ink-400">{fmtDate(s.createdAt)}</td>
                      <td className="text-ink-400">{fmtDate(s.lastSeenAt)}</td>
                      <td className="text-ink-400">{fmtDate(s.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
