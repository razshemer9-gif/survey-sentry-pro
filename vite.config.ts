import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

/**
 * Which build this is. Taken from the commit being built, so the id on
 * screen can be matched against the repository, and falling back to the
 * clock where git is not available.
 */
function buildId(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

const BUILD_ID = buildId();
const BUILD_TIME = new Date().toISOString();

/**
 * A file the running app can ask for to find out whether it is out of date.
 * It must never be cached, which is why it is a file of its own rather than
 * something read out of index.html — see lib/build-version.
 */
function versionFile(): Plugin {
  return {
    name: "shemer-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ build: BUILD_ID, time: BUILD_TIME }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/survey-sentry-pro/" : "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), versionFile(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    __BUILD_ID__: JSON.stringify(mode === "production" ? BUILD_ID : "dev"),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks — code edits no longer invalidate the user's
        // cached copies of React / Supabase. No runtime behavior change.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
