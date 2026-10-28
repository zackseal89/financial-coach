# Deployment guide

## Google Cloud

Project: `operating-ethos-513011-c0`. Cloud Run region: `us-central1`; Vertex AI model location: `global`.

Enable Cloud Run, Artifact Registry, Cloud Build, Vertex AI, Secret Manager, IAM, IAM Credentials, and Security Token Service APIs. Use separate service accounts:

- `financial-coach-runtime`: Vertex AI User and access to the app-token secret.
- `financial-coach-builder`: Cloud Run Builder.
- `financial-coach-invoker`: Cloud Run Invoker on this service; only the Vercel Preview workload can mint ID tokens for it.

Create the `financial-coach-api-token` secret in Secret Manager and grant the runtime identity `roles/secretmanager.secretAccessor`. Do not pass token values as command arguments or commit them. Deploy the backend from `backend/`:

```powershell
gcloud run deploy financial-coach-api --source backend --project operating-ethos-513011-c0 --region us-central1 --service-account financial-coach-runtime@operating-ethos-513011-c0.iam.gserviceaccount.com --build-service-account projects/operating-ethos-513011-c0/serviceAccounts/financial-coach-builder@operating-ethos-513011-c0.iam.gserviceaccount.com --no-allow-unauthenticated --min-instances 0 --max-instances 1 --concurrency 4 --timeout 240 --memory 1Gi --set-env-vars 'COACH_MODE=live,GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=operating-ethos-513011-c0,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.8-flash' --set-secrets COACH_API_TOKEN=financial-coach-api-token:latest
```

Keep Cloud Run private. Grant `roles/run.invoker` to the invoker service account on the service. For local testing, use:

```powershell
gcloud run services proxy financial-coach-api --project operating-ethos-513011-c0 --region us-central1 --port 8080
```

## Vercel and Workload Identity Federation

Create a Google workload identity pool/provider for issuer `https://oidc.vercel.com/zackseal89s-projects`, mapping `google.subject=assertion.sub`. Restrict its condition to this project's Preview subject:

`owner:zackseal89s-projects:project:financial-coach:environment:preview`

Grant that principal `roles/iam.serviceAccountTokenCreator` on `financial-coach-invoker`. The app's `GCP_WORKLOAD_IDENTITY_PROVIDER` value is the provider resource name, for example:

`//iam.googleapis.com/projects/183522916153/locations/global/workloadIdentityPools/financial-coach/providers/vercel`

The Next.js server routes request the corresponding HTTPS audience from Vercel, exchange the assertion with Google STS, and mint a Cloud Run ID token through IAM Credentials. They send the app token in a separate server-only header.

Set these sensitive server variables in the Vercel **Preview** environment only: `BACKEND_URL`, `COACH_API_TOKEN`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, and `GCP_RUN_INVOKER_SERVICE_ACCOUNT`. Keep Vercel Preview Deployment Protection enabled. The public production site falls back to deterministic KES demo calculations and does not send personal inputs to Vertex AI.

The analysis and chat routes request 240-second and 90-second function limits. Confirm the Vercel plan supports those limits. Google Cloud credits do not pay for Vercel.

## Model

The backend defaults to `gemini-3.8-flash` on the global Vertex AI endpoint. Google's current model documentation lists it as GA and supported in `global`; the older Gemini 2.5 Flash model retired on 2026-10-20.

## References

- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions
- https://docs.cloud.google.com/run/docs/ai/build-and-deploy-ai-agents/deploy-adk-agent
- https://vercel.com/docs/oidc/gcp- https://vercel.com/docs/frameworks/full-stack/nextjs
