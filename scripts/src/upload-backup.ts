import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { basename } from "path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: upload-backup <file-path>");
  process.exit(1);
}

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (!bucketId) {
  console.error(
    "ERROR: DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set. Object storage may not be provisioned."
  );
  process.exit(1);
}

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const bucket = storage.bucket(bucketId);

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);
const fileName = basename(filePath, ".sql");
const destination = `backups/${fileName}_${timestamp}.sql`;

try {
  readFileSync(filePath);
} catch {
  console.error(`ERROR: Cannot read file: ${filePath}`);
  process.exit(1);
}

const file = bucket.file(destination);
await bucket.upload(filePath, { destination });

const [metadata] = await file.getMetadata();
const storagePath = `gs://${bucketId}/${destination}`;
const selfLink = metadata.selfLink as string | undefined;

console.log(`STORAGE_PATH=${storagePath}`);
if (selfLink) {
  console.log(`STORAGE_LINK=${selfLink}`);
}
