import { NextResponse } from "next/server";
import * as jose from "jose";

const JWT_SECRET = process.env.NEXTAUTH_JWT_SECRET!;

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.split("; ").find((c) => c.startsWith("token="));
  if (!match) return NextResponse.json({ user: null });

  const token = match.split("=")[1];
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return NextResponse.json({ user: payload });
  } catch (e) {
    return NextResponse.json({ user: null });
  }
}
