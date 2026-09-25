import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseUrl = "http://localhost:3000";
const content = "TempLink integration smoke test";
const file = new Blob([content], { type: "text/plain" });
const password = "TempLink-Test-2026";
const updatedContent = "TempLink updated integration smoke test";
const updatedFile = new Blob([updatedContent], { type: "text/plain" });
const updatedPassword = "TempLink-Updated-2026";
let createdDocument = null;
let storagePath = null;

const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !publicKey || !secretKey) {
  throw new Error("Supabase environment is incomplete.");
}

const browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey);
const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  });
  if (!login.ok) throw new Error(`Admin login failed: ${await login.text()}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Admin session cookie was not returned.");

  const init = await fetch(`${baseUrl}/api/admin/uploads/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      fileName: "templink-smoke-test.txt",
      fileType: "text/plain",
      fileSize: file.size,
    }),
  });
  const initResult = await init.json();
  if (!init.ok) throw new Error(`Upload init failed: ${JSON.stringify(initResult)}`);
  storagePath = initResult.path;

  const { error: uploadError } = await browserClient.storage
    .from("documents")
    .uploadToSignedUrl(initResult.path, initResult.token, file, {
      contentType: "text/plain",
    });
  if (uploadError) throw uploadError;

  const create = await fetch(`${baseUrl}/api/admin/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      storagePath,
      title: "TempLink smoke test",
      originalName: "templink-smoke-test.txt",
      mimeType: "text/plain",
      sizeBytes: file.size,
      downloadStart: new Date(Date.now() - 60_000).toISOString(),
      downloadEnd: new Date(Date.now() + 10 * 60_000).toISOString(),
      password,
    }),
  });
  const createResult = await create.json();
  if (!create.ok) throw new Error(`Document create failed: ${JSON.stringify(createResult)}`);
  createdDocument = createResult.document;

  const replacementInit = await fetch(`${baseUrl}/api/admin/uploads/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      fileName: "templink-smoke-test-updated.txt",
      fileType: "text/plain",
      fileSize: updatedFile.size,
    }),
  });
  const replacementInitResult = await replacementInit.json();
  if (!replacementInit.ok) {
    throw new Error(`Replacement upload init failed: ${JSON.stringify(replacementInitResult)}`);
  }

  const { error: replacementUploadError } = await browserClient.storage
    .from("documents")
    .uploadToSignedUrl(
      replacementInitResult.path,
      replacementInitResult.token,
      updatedFile,
      { contentType: "text/plain" },
    );
  if (replacementUploadError) throw replacementUploadError;

  const update = await fetch(`${baseUrl}/api/admin/documents/${createdDocument.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: "TempLink updated smoke test",
      downloadStart: new Date(Date.now() - 60_000).toISOString(),
      downloadEnd: new Date(Date.now() + 10 * 60_000).toISOString(),
      password: updatedPassword,
      storagePath: replacementInitResult.path,
      originalName: "templink-smoke-test-updated.txt",
      mimeType: "text/plain",
      sizeBytes: updatedFile.size,
    }),
  });
  const updateResult = await update.json();
  if (!update.ok) throw new Error(`Document update failed: ${JSON.stringify(updateResult)}`);
  createdDocument = updateResult.document;
  storagePath = replacementInitResult.path;

  const download = await fetch(`${baseUrl}/api/download/${createdDocument.slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: updatedPassword }),
  });
  const downloadResult = await download.json();
  if (!download.ok) throw new Error(`Download grant failed: ${JSON.stringify(downloadResult)}`);

  const object = await fetch(downloadResult.url);
  const downloadedContent = await object.text();
  if (!object.ok || downloadedContent !== updatedContent) {
    throw new Error("Signed download content did not match the uploaded file.");
  }

  const remove = await fetch(`${baseUrl}/api/admin/documents/${createdDocument.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  const removeResult = await remove.json();
  if (!remove.ok) throw new Error(`Document delete failed: ${JSON.stringify(removeResult)}`);
  createdDocument = null;
  storagePath = null;

  console.log(
    "Smoke test passed: login, create, file replacement, metadata/password update, download and delete.",
  );
} finally {
  if (createdDocument?.id) {
    await adminClient.from("documents").delete().eq("id", createdDocument.id);
  }
  if (storagePath) {
    await adminClient.storage.from("documents").remove([storagePath]);
  }
}
