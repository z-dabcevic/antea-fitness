"use client";

import { useState } from "react";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSignup() {
    setMsg("Registriram...");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        display_name: displayName || username,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMsg(data.error || "Greška pri registraciji 😕");
      return;
    }

    // nakon signup-a, još nisi prijavljen.
    // Možemo automatski prijaviti korisnika? Ovdje imaš dvije opcije:
    // (A) Samo pošalji ga na /login da se ulogira.
    // (B) Ili ćeš malo kasnije doraditi signup rutu da odmah napravi i login.
    // Za sad A (jednostavnije):
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900 p-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4 text-center">
          Registracija
        </h1>

        <label className="block text-sm font-medium mb-1">
          Korisničko ime
        </label>
        <input
          className="w-full border rounded-xl p-2 mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="npr. antea"
        />

        <label className="block text-sm font-medium mb-1">
          Ime za prikaz (opcionalno)
        </label>
        <input
          className="w-full border rounded-xl p-2 mb-4"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="npr. Kraljica čučnjeva"
        />

        <label className="block text-sm font-medium mb-1">
          Lozinka
        </label>
        <input
          className="w-full border rounded-xl p-2 mb-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
        />

        <button
          className="w-full py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition"
          onClick={handleSignup}
        >
          Stvori račun
        </button>

        {msg && (
          <p className="text-center text-sm mt-4">{msg}</p>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          Već imaš račun? <a href="/login" className="underline">Prijava</a>
        </p>
      </div>
    </main>
  );
}
