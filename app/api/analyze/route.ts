import { getBackendAuthHeaders } from "../_lib/backend-auth";
import { demoAnalysis } from "../_lib/demo";

export const maxDuration = 240;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 64000)
      return Response.json({ detail: "Request too large" }, { status: 413 });

    if (process.env.VERCEL === "1" && !process.env.BACKEND_URL) {
      try {
        return Response.json(demoAnalysis(JSON.parse(body)));
      } catch {
        return Response.json(
          { detail: "Check your financial inputs." },
          { status: 400 },
        );
      }
    }

    const upstream = await fetch(
      (process.env.BACKEND_URL || "http://127.0.0.1:8080") + "/analyze/stream",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getBackendAuthHeaders()),
        },
        body,
        signal: AbortSignal.timeout(190000),
        cache: "no-store",
      },
    );
    if (!upstream.ok) {
      return Response.json(await upstream.json(), { status: upstream.status });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json(
      {
        detail:
          "Cannot reach your coach. Start the Python backend and try again.",
      },
      { status: 502 },
    );
  }
}