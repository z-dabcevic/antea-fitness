"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function NavBar() {
  const [isGM, setIsGM] = useState<boolean | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  async function refreshAuthState() {
    const res = await fetch("/api/auth/me", { method: "GET" });
    const data = await res.json();
    if (!data.user) {
        setIsLoggedIn(false);
        setIsGM(false);
        return;
    }
    setIsLoggedIn(true);
    setIsGM(data.user.role === "gm");
  }

  useEffect(() => {
    refreshAuthState();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700">
        <div className="flex gap-4 flex-wrap">
          <Link href="/" className="hover:text-black transition">
            🏠 Početna
          </Link>
          <Link href="/log" className="hover:text-black transition">
            ➕ Aktivnost
          </Link>
          <Link href="/rewards" className="hover:text-black transition">
            🎁 Nagrade
          </Link>
          <Link href="/progress" className="hover:text-black transition">
            📅 Napredak
          </Link>
          {isGM && (
            <Link href="/approvals" className="hover:text-black transition">
              ✅ Odobravanje
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-lg transition"
            >
              🚪 Odjava
            </button>
          ) : (
            <Link
              href="/login"
              className="text-xs bg-gray-900 text-white hover:bg-gray-800 px-3 py-1 rounded-lg transition"
            >
              Prijava
            </Link>
          )}

          <span className="text-[10px] text-gray-400">
            {isGM === null ? "..." : isGM ? "GM mode" : "hero mode"}
          </span>
        </div>
      </div>
    </nav>
  );
}
