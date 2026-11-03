# Prototype initial (Cloudflare Workers)

Ces fichiers constituent le premier prototype du dépôt : une page statique servie par un Worker Cloudflare,
avec trois joueurs **fictifs** (Alice, Bob, Charlie) triés en JavaScript côté navigateur.

Ils sont conservés à titre d'historique. Le site officiel est désormais construit avec Vite et déployé sur
Netlify (voir le `README.md` à la racine). La logique de tri de `public/script.js` a été reprise et étendue
dans la page Classement (`site/assets/js/classement.js`).
