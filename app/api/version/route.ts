export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const branch = process.env.VERCEL_GIT_COMMIT_REF || null;
  const ts = new Date().toISOString();
  return new Response(JSON.stringify({ sha, branch, ts }), {
    headers: { "content-type": "application/json" },
  });
}
