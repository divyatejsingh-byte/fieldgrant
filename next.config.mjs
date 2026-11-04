/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Do not let `next dev` write an AGENTS.md into the repo root.
  agentRules: false,
};

export default nextConfig;
