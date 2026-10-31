import { resolve } from "node:path";
import { defineConfig } from "vite";

// Six véritables pages HTML : Vite doit les prendre toutes comme points d'entrée.
export default defineConfig({
  root: "site",
  input: {
    accueil: resolve(import.meta.dirname, "site/index.html"),
    calendrier: resolve(import.meta.dirname, "site/calendrier/index.html"),
    tournois: resolve(import.meta.dirname, "site/tournois/index.html"),
    elo: resolve(import.meta.dirname, "site/elo-ul/index.html"),
    classement: resolve(import.meta.dirname, "site/classement/index.html"),
    apropos: resolve(import.meta.dirname, "site/a-propos/index.html"),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
