# Infrastructure

Provisions everything the ETL needs to run as a scheduled Cloud Run Job,
built automatically from GitHub via Cloud Build:

- Artifact Registry repo for the ETL image
- Service accounts (job runtime, Cloud Scheduler invoker) + IAM bindings
- Secret Manager containers for the DB/API credentials (values set manually,
  not by Terraform — see below)
- The Cloud Run Job itself
- Cloud Build GitHub connection + trigger (`cloudbuild.yaml` at repo root)
- Cloud Scheduler job that runs the ETL daily (`var.schedule`, 06:00 Europe/Madrid)

## First-time setup

1. **Install the Cloud Build GitHub App and get a PAT** (does the OAuth
   dance once, up front, so `terraform apply` never needs a browser step):
   - Visit `https://github.com/apps/google-cloud-build`, click **Install**,
     choose your account, and select **Only select repositories** →
     `arredond/dondedonar`.
   - Find the installation ID: `https://github.com/settings/installations`
     → open "Google Cloud Build" → the URL's trailing number.
     For `arredond/dondedonar` this is `160560634` (also kept in the gitignored
     `terraform/terraform.tfvars`).
   - Create a GitHub PAT (classic, scopes `repo`, `read:user`, `read:org` —
     or an equivalent fine-grained token scoped to this repo).

2. **Auth**: `gcloud auth application-default login` (and make sure
   `gcloud config get-value project` is `donde-donar-422906`, or pass
   `-var gcp_project=...`).

3. **Apply**, passing the installation ID from step 1:
   ```bash
   cd terraform
   terraform init
   terraform apply -var github_app_installation_id=<id>
   ```
   (or put `github_app_installation_id = <id>` in a `terraform.tfvars` —
   it's gitignored).

4. **Set the secret values** (Terraform only creates empty secret
   containers, so nothing sensitive ever touches state or this repo):
   ```bash
   gcloud secrets versions add github-token --data-file=- <<< "<the PAT from step 1>"
   echo -n "<value>" | gcloud secrets versions add pg-host --data-file=-
   echo -n "<value>" | gcloud secrets versions add pg-database --data-file=-
   echo -n "<value>" | gcloud secrets versions add pg-port --data-file=-
   echo -n "<value>" | gcloud secrets versions add pg-user --data-file=-
   echo -n "<value>" | gcloud secrets versions add pg-password --data-file=-
   echo -n "<value>" | gcloud secrets versions add google-maps-api-key --data-file=-
   ```
   The `github-token` secret's value must exist *before* step 3's `apply`
   can succeed — the connection resource reads it immediately. If you'd
   rather set it first, run `terraform apply -target=google_secret_manager_secret.github_token` on its own, add the version, then apply the rest.

5. **Verify the connection**: `terraform output github_connection_stage`
   should read `COMPLETE`. If not, `terraform output github_connection_action_uri` names a leftover manual step.

6. **First image**: `google_cloud_run_v2_job` refuses to create the Job at
   all unless the image tag it points to already exists, so `apply` fails on
   the very first run until you've pushed at least one image (chicken/egg —
   Terraform can't fix this by itself). Either push to `main` once the
   trigger exists, or build straight to Artifact Registry yourself:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml \
     --substitutions=_REGION=europe-southwest1,_REPO=hirudo,_JOB_NAME=hirudo-etl,_SA_EMAIL=hirudo-etl-runtime@donde-donar-422906.iam.gserviceaccount.com
   ```
   If you build locally with plain `docker build` instead, pass
   `--platform linux/amd64` — Cloud Run only runs amd64, and a local build
   on Apple Silicon defaults to arm64, which fails at container start with
   no application log output at all (just "container may have exited
   abnormally"). Cloud Build's own workers are amd64 already, so this only
   matters for manual local builds.

7. **Try it**: `gcloud run jobs execute hirudo-etl --region=europe-southwest1`
   and check the logs.

## Notes

- State is local (`terraform.tfstate`) for now — fine for a single operator,
  but consider a GCS backend (commented out in `versions.tf`) once this
  starts running in more than one place.
- `HERE_API_KEY` / `SUPABASE_API_KEY` from `.env.sample` aren't read by the
  ETL anymore, so no secrets were created for them.
