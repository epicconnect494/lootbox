/** Presentation helpers shared by the raffle list and detail pages. */
export function raffleStatusTone(s: string): "cyan" | "violet" | "amber" | "lime" | "neutral" {
  switch (s) {
    case "OPEN":
      return "cyan";
    case "UPCOMING":
      return "violet";
    case "CLOSED":
      return "amber";
    default:
      return "neutral";
  }
}

export function entryModeLabel(m: string): string {
  return m === "FREE" ? "Free entry" : m === "PROMOTIONAL" ? "Promotional" : "Purchase-linked + free route";
}
