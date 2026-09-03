import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, SectionTitle, Stat, Mono } from "@/components/ui/primitives";
import { ledgerOverview } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { fmtDate, moneyStr } from "@/lib/format";
import { ser } from "@/components/admin/serialize";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { TransactionsTable } from "@/components/admin/TransactionsTable";
import { ChargebackForm, ReconcilePanel, RefundForm } from "@/components/admin/FinanceActions";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const session = await requireAdmin("finance.read");
  const { db } = await viewer();
  const o = await ledgerOverview(db);
  const canWrite = session.user.permissions.has("finance.write");
  return (
    <div className="space-y-6">
      <PageHeader title="Finance" sub="Double-entry ledger: every transaction sums to zero. System accounts carry negative balances for money owed to customers (liability) and positive for money received." />
      <Panel>
        <SectionTitle title="Ledger overview" />
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="User liability" value={moneyStr(o.userLiability.totalMinor)} hint={`${o.userLiability.accounts} customer accounts`} />
          <Stat label="System accounts" value={o.systemAccounts.length} />
          <Stat label="Recent transactions" value={o.transactions.length} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>System account</th>
                <th>Currency</th>
                <th>Balance</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {o.systemAccounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.kind.replace(/_/g, " ")}</td>
                  <td>{a.currency}</td>
                  <td className={a.balanceMinor < 0n ? "text-danger" : "text-ink-100"}>{moneyStr(a.balanceMinor, a.currency)}</td>
                  <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ReconcilePanel />

      <Panel>
        <SectionTitle title="Recent transactions" sub="Most recent 100 with their balanced entries" />
        <TransactionsTable rows={ser(o.transactions)} accounts={ser(o.systemAccounts)} />
      </Panel>

      {canWrite && (
        <div className="grid gap-6 xl:grid-cols-2">
          <RefundForm />
          <ChargebackForm />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel>
          <SectionTitle title="Payments" sub="Most recent 50" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>ID</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {o.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(p.createdAt)}</td>
                    <td>
                      <Mono>{p.id.slice(0, 8)}</Mono>
                    </td>
                    <td className="text-xs">{p.userId.slice(0, 8)}</td>
                    <td>{moneyStr(p.amountMinor, p.currency)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
                {o.payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-ink-400">
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel>
          <SectionTitle title="Refunds" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {o.refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td>
                    <td className="text-xs">{r.userId.slice(0, 8)}</td>
                    <td>{moneyStr(r.amountMinor, r.currency)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-xs text-ink-300">{r.reason}</td>
                  </tr>
                ))}
                {o.refunds.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-ink-400">
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel>
          <SectionTitle title="Chargebacks" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {o.chargebacks.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(c.createdAt)}</td>
                    <td>
                      <Mono>{c.paymentId.slice(0, 8)}</Mono>
                    </td>
                    <td>{moneyStr(c.amountMinor, c.currency)}</td>
                    <td>
                      <StatusBadge status={c.status === "LOST" ? "LOST_CB" : c.status} />
                    </td>
                    <td className="text-xs text-ink-300">{c.reasonCode ?? "—"}</td>
                  </tr>
                ))}
                {o.chargebacks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-ink-400">
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
