import { resolve } from "node:path";
import { defineConfig } from "vite";

// Sept pages publiques + une sous-page de gestion des tournois.
export default defineConfig({
  root: "site",
  input: {
    accueil: resolve(import.meta.dirname, "site/index.html"),
    calendrier: resolve(import.meta.dirname, "site/calendrier/index.html"),
    tournois: resolve(import.meta.dirname, "site/tournois/index.html"),
    gestionTournois: resolve(import.meta.dirname, "site/tournois/gestion/index.html"),
    elo: resolve(import.meta.dirname, "site/elo-ul/index.html"),
    classement: resolve(import.meta.dirname, "site/classement/index.html"),
    apropos: resolve(import.meta.dirname, "site/a-propos/index.html"),
    contact: resolve(import.meta.dirname, "site/contact/index.html"),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
