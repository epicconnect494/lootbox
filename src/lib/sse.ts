import { subscribe, type RealtimeEvent } from "./realtime";

/** Server-Sent Events stream for a channel; sends heartbeats and closes when the client disconnects. */
export function sseResponse(channel: string, req: Request, initial?: unknown): Response {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: { type: string; payload: unknown; at?: string }) => {
        try {
          controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`));
        } catch {
          /* closed */
        }
      };
      if (initial !== undefined) send({ type: "snapshot", payload: initial });
      unsub = subscribe(channel, (e: RealtimeEvent) => send(e));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15_000);
      req.signal.addEventListener("abort", () => {
        unsub?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsub?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
