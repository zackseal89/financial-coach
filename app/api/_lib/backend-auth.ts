type GoogleTokenResponse = { access_token?: string; id_token?: string };

async function readTokenResponse(response: Response): Promise<GoogleTokenResponse> {
  if (!response.ok) throw new Error("Cloud Run authentication failed");
  return (await response.json()) as GoogleTokenResponse;
}

export async function getBackendAuthHeaders(): Promise<Record<string, string>> {
  const applicationToken = process.env.COACH_API_TOKEN || "";
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER;
  const serviceAccount = process.env.GCP_RUN_INVOKER_SERVICE_ACCOUNT;

  if (process.env.VERCEL === "1" && provider && serviceAccount) {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) throw new Error("BACKEND_URL is required for Cloud Run auth");

    const { getVercelOidcToken } = await import("@vercel/oidc");
    const subjectToken = await getVercelOidcToken({ audience: provider });
    const tokenResponse = await fetch("https://sts.googleapis.com/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
        audience: provider,
        requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
        scope: "https://www.googleapis.com/auth/cloud-platform",
        subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
        subjectToken,
      }),
      cache: "no-store",
    });
    const access = await readTokenResponse(tokenResponse);
    if (!access.access_token) throw new Error("Cloud Run authentication failed");

    const audience = backendUrl.replace(/\/+$/, "");
    const identityResponse = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}:generateIdToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access.access_token}`,
        },
        body: JSON.stringify({ audience, includeEmail: true }),
        cache: "no-store",
      },
    );
    const identity = await readTokenResponse(identityResponse);
    if (!identity.id_token) throw new Error("Cloud Run authentication failed");

    return {
      Authorization: `Bearer ${identity.id_token}`,
      ...(applicationToken ? { "X-Coach-Token": applicationToken } : {}),
    };
  }

  return { Authorization: `Bearer ${applicationToken}` };
}

