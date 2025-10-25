"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleLogin() {
    setMsg("Prijava...");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMsg(data.error || "Neispravni podaci 😕");
      return;
    }

    // cookie je sad postavljen (token=JWT)
    window.location.href = "/after-login-local";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900 p-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4 text-center">
          Prijava
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
          onClick={handleLogin}
        >
          Prijavi se
        </button>

        {msg && (
          <p className="text-center text-sm mt-4">{msg}</p>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          Nemaš račun? <a href="/signup" className="underline">Registriraj se</a>
        </p>
      </div>
    </main>
  );
}
