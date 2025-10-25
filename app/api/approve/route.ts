import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// helper: čitanje JWT iz cookieja
async function getUserFromCookie(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.split("; ").find((c) => c.startsWith("token="));
  if (!match) return null;

  const token = match.split("=")[1];

  try {
    const { payload } = await jose.jwtVerify(
      token,
      new TextEncoder().encode(process.env.NEXTAUTH_JWT_SECRET!)
    );
    return payload as {
      sub: string;
      username: string;
      role: string;
    };
  } catch (err) {
    console.error("JWT verify error:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    console.log("---- /api/approve START ----");

    // 1. auth check
    const currentUser = await getUserFromCookie(req);
    console.log("currentUser =", currentUser);

    if (!currentUser) {
      console.error("not logged in");
      return NextResponse.json(
        { error: "Nisi prijavljen." },
        { status: 401 }
      );
    }
    if (currentUser.role !== "gm") {
      console.error("not gm");
      return NextResponse.json(
        { error: "Nemaš ovlasti." },
        { status: 403 }
      );
    }

    // 2. body
    const body = await req.json();
    console.log("body =", body);
    const { id } = body;
    if (!id) {
      console.error("no id in body");
      return NextResponse.json(
        { error: "Nedostaje ID aktivnosti." },
        { status: 400 }
      );
    }

    // 3. dohvati action_log red
    const { data: rawLogRow, error: logErr } = await supabase
      .from("action_log")
      .select(
        "id, user_id, status, action_type:action_type_id(id, base_points, negative)"
      )
      .eq("id", id)
      .single();

    console.log("rawLogRow =", rawLogRow, "logErr =", logErr);

    if (logErr || !rawLogRow) {
      console.error("cannot load action_log");
      return NextResponse.json(
        { error: "Ne mogu pronaći zahtjev." },
        { status: 404 }
      );
    }

    // ----- NORMALIZACIJA action_type -----
    // Supabase zna vratiti `action_type` kao objekt ili kao array s jednim elementom,
    // a TypeScript u buildu poludi jer misli da je to uvijek array.
    // Ovdje ga ručno normaliziramo.
    //
    // Koristimo `any` da ušutkamo TS u buildu, jer nam ovdje sigurnost tipova nije kritična
    // (u svakom slučaju validaciju radimo i runtime-om).
    const rowAny: any = rawLogRow;

    let actionType: any = rowAny.action_type;
    if (Array.isArray(actionType)) {
      // Ako iz nekog razloga dobijemo niz, uzmi prvi element
      actionType = actionType[0];
    }

    if (!actionType) {
      console.error("no action_type after normalize");
      return NextResponse.json(
        { error: "Nema definiran tip aktivnosti." },
        { status: 500 }
      );
    }

    // ako je već approved, prekini
    if (rowAny.status === "approved") {
      console.log("already approved");
      return NextResponse.json({
        message: "Već odobreno.",
      });
    }

    // 4. izračun bodova
    const basePoints = actionType.base_points || 0;
    const pointsToApply = actionType.negative
      ? -Math.abs(basePoints)
      : Math.abs(basePoints);

    console.log("pointsToApply =", pointsToApply);

    // 5. dohvati user_stats
    const { data: statsRow, error: statsErr } = await supabase
      .from("user_stats")
      .select("total_points")
      .eq("user_id", rowAny.user_id)
      .single();

    console.log("statsRow =", statsRow, "statsErr =", statsErr);

    if (statsErr || !statsRow) {
      console.error("cannot load user_stats");
      return NextResponse.json(
        { error: "Greška pri dohvaćanju bodova.", details: statsErr?.message },
        { status: 500 }
      );
    }

    const newTotal = (statsRow.total_points || 0) + pointsToApply;
    console.log("newTotal =", newTotal);

    // 6. update user_stats (dodaj bodove)
    const { error: statsUpdateErr } = await supabase
      .from("user_stats")
      .update({
        total_points: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", rowAny.user_id);

    console.log("statsUpdateErr =", statsUpdateErr);

    if (statsUpdateErr) {
      console.error("cannot update user_stats");
      return NextResponse.json(
        {
          error: "Greška pri ažuriranju bodova.",
          details: statsUpdateErr.message,
        },
        { status: 500 }
      );
    }

    // 7. označi action_log approved (bez approved_at jer ga nemaš u tablici)
    const { error: logUpdateErr } = await supabase
      .from("action_log")
      .update({
        status: "approved",
      })
      .eq("id", id);

    console.log("logUpdateErr =", logUpdateErr);

    if (logUpdateErr) {
      console.error("cannot update action_log");
      return NextResponse.json(
        {
          error: "Greška pri označavanju odobrenja.",
          details: logUpdateErr.message,
        },
        { status: 500 }
      );
    }

    console.log("SUCCESS");
    console.log("---- /api/approve END ----");

    return NextResponse.json({
      message: "Odobreno i bodovi dodani ✅",
      added: pointsToApply,
      newTotal,
    });
  } catch (err: any) {
    console.error("UNEXPECTED ERROR in /api/approve:", err);
    return NextResponse.json(
      { error: "Fatal server error", details: String(err) },
      { status: 500 }
    );
  }
}
