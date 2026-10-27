# Deployment guide

## Google Cloud
Project: `oreos-509708`. Region example: `us-central1`; model location: `global`.
Confirm billing credits and model availability in the project before live testing.

Enable Cloud Run, Artifact Registry, Cloud Build, and Vertex AI APIs. Create a dedicated runtime service account and grant only Vertex AI User. Deploy the backend directory using its Dockerfile:

```powershell
gcloud run deploy financial-coach-api --source backend --project oreos-509708 --region us-central1 --service-account financial-coach-runtime@oreos-509708.iam.gserviceaccount.com --no-allow-unauthenticated --min-instances 0 --max-instances 1 --concurrency 4 --timeout 240 --memory 1Gi --set-env-vars COACH_MODE=live,GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=oreos-509708,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash
```

This command assumes the service account already exists and required deploy/build permissions have been granted. Set COACH_API_TOKEN using a Secret Manager secret. The service intentionally refuses cloud analysis without that token.

The default deployment above is IAM-private. For local testing, use `gcloud run services proxy financial-coach-api --project oreos-509708 --region us-central1 --port 8080`. For Vercel integration, configure workload identity federation and Cloud Run invocation, or explicitly choose a publicly reachable service protected by the application token. The current Next.js route sends the application token only; it does not yet mint Cloud Run IAM identity tokens.

## Vercel
Import `zackseal89/financial-coach`, select Next.js, and leave Root Directory at repository root. Set server-only BACKEND_URL and COACH_API_TOKEN. Never use NEXT_PUBLIC_ for credentials. Keep preview deployment protection enabled while testing. The analysis route requests a 240-second function limit; confirm your Vercel plan supports it.

For a public demonstration, prefer demo mode until authentication, rate limiting, model evaluation, and billing alerts are implemented. Google Cloud credits do not pay for Vercel.

## References
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart
- https://docs.cloud.google.com/run/docs/ai/build-and-deploy-ai-agents/deploy-adk-agent
- https://vercel.com/docs/frameworks/full-stack/nextjs
