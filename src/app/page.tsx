import { LandingPage } from "@/components/landing/LandingPage";
import pkg from "../../package.json";

// Server component: reads build-time facts so they never ship hard-coded in the client bundle.
export default function Home() {
  const github = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || null;
  return <LandingPage version={pkg.version} githubUrl={github} />;
}
