import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const JWT_SECRET = process.env.NEXTAUTH_JWT_SECRET!;
const EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN || 3600); // seconds

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "username & password required" }, { status: 400 });
  }

  const { data: userRow, error } = await supabase
    .from("local_user")
    .select("id, username, password_hash, role, display_name")
    .eq("username", username)
    .maybeSingle();

  if (error || !userRow) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = bcrypt.compareSync(password, userRow.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // potpiši JWT
  const alg = "HS256";
  const secret = new TextEncoder().encode(JWT_SECRET);
  const jwt = await new jose.SignJWT({
    sub: userRow.id,
    username: userRow.username,
    role: userRow.role
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(secret);

  // postavi cookie (HttpOnly)
  const isProd = process.env.NODE_ENV === "production";
  const cookie = `token=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${EXPIRES_IN}; ${isProd ? "Secure; " : ""}`;

  const res = NextResponse.json({ ok: true, user: { id: userRow.id, username: userRow.username, role: userRow.role } });
  res.headers.set("Set-Cookie", cookie);
  return res;
}
