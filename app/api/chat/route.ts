import { getBackendAuthHeaders } from "../_lib/backend-auth";
import { demoChat } from "../_lib/demo";

export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 32000)
      return Response.json({ detail: "Chat request too large" }, { status: 413 });

    if (process.env.VERCEL === "1" && !process.env.BACKEND_URL) {
      try {
        return Response.json(demoChat(JSON.parse(body)));
      } catch {
        return Response.json({ detail: "Check your chat message and financial profile." }, { status: 400 });
      }
    }

    const upstream = await fetch(
      (process.env.BACKEND_URL || "http://127.0.0.1:8080") + "/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getBackendAuthHeaders()),
        },
        body,
        signal: AbortSignal.timeout(80000),
        cache: "no-store",
      },
    );
    return Response.json(await upstream.json(), { status: upstream.status });
  } catch {
    return Response.json(
      { detail: "Cannot reach your coach. Check the Python backend and try again." },
      { status: 502 },
    );
  }
}