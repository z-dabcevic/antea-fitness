const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/**
 * Next.js 16 default je Turbopack, ali next-pwa koristi webpack config.
 * Recimo Nextu eksplicitno da koristi webpack i time utišamo error na Vercelu.
 */
const nextConfig = {
  reactStrictMode: true,

  // 👇 ovo je novo i BITNO
  turbopack: {
    // prazan objekt = eksplicitno kažemo "znam da postoji turbopack config"
    // i Next više neće paničariti
  },
};

module.exports = withPWA(nextConfig);
