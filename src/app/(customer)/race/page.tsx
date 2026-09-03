import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { RaceLive, type RaceView } from "@/components/events/RaceLive";
import { Empty, Panel, SectionTitle } from "@/components/ui/primitives";
import { computeLeaderboard, currentRace, pastRaces, raceView } from "@/domain/races";
import { fmtDate, moneyStr } from "@/lib/format";
import { json, viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Weekly Race" };

export default async function RacePage() {
  const { db, session, userId } = await viewer();
  const current = await currentRace(db);
  const view = current ? await raceView(db, current.id, userId) : null;
  const past = await pastRaces(db);
  const history = await Promise.all(past.map(async (r) => ({ race: r, top: await computeLeaderboard(db, r.id, 3) })));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
          <Trophy className="text-amber-400" aria-hidden /> Weekly Race
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-400">A seven-day points race with a published prize ladder and a hashed scoring policy. Points never change odds; they only rank participation.</p>
      </div>

      {view ? <RaceLive initial={json(view) as unknown as RaceView} signedIn={!!session} /> : <Empty title="No race is scheduled" body="Check back soon; the next race will appear here with its prize ladder and scoring policy." />}

      <Panel as="section" aria-labelledby="past-title">
        <SectionTitle title="Past races" sub="Settled ladders with their top three" />
        {history.length === 0 ? (
          <p className="text-sm text-ink-400">No settled races yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Race</th>
                  <th scope="col">Window</th>
                  <th scope="col">1st</th>
                  <th scope="col">2nd</th>
                  <th scope="col">3rd</th>
                </tr>
              </thead>
              <tbody>
                {history.map(({ race, top }) => (
                  <tr key={race.id}>
                    <td className="font-semibold">{race.name}</td>
                    <td className="text-ink-400">
                      {fmtDate(race.startsAt, { dateStyle: "medium" })} → {fmtDate(race.endsAt, { dateStyle: "medium" })}
                    </td>
                    {[0, 1, 2].map((i) => {
                      const row = top[i];
                      return (
                        <td key={i}>
                          {row ? (
                            <span>
                              <span className={i === 0 ? "text-lime-300" : "text-ink-100"}>{row.display_name}</span>
                              <span className="ml-1 text-xs text-ink-400">
                                {Number(row.points).toLocaleString("en-US")} pts{row.prize_amount_minor ? ` · ${moneyStr(row.prize_amount_minor, race.currency)}` : ""}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
