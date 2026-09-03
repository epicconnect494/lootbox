import type { accountOverview } from "@/domain/users";
import type { Json } from "@/components/events/json-types";

export type AccountOverview = Json<Awaited<ReturnType<typeof accountOverview>>>;
