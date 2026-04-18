# NexShare

## Badges

[![Deploy to GitHub Pages](https://github.com/nexos20lv/NexShare/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/nexos20lv/NexShare/actions/workflows/deploy-pages.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Online-2ea44f?logo=github)](https://btmpierre.me/NexShare/)

NexShare est une web app de transfert P2P (WebRTC) avec code de partage, QR code et interface futuriste.

## Apercu

- Transfert direct de pair a pair (P2P)
- Code de session a 6 caracteres
- QR code pour connexion rapide
- Interface responsive (desktop + mobile)
- Session ephemere avec expiration

## Stack

- HTML/CSS/JavaScript vanilla
- PeerJS pour la signalisation WebRTC
- Deploiement GitHub Pages via GitHub Actions

## Structure du projet

- index.html
- assets/
- css/style.css
- js/app.js
- js/transfer.js
- js/particles.js
- js/qr-code.js

## Lancer en local

Option 1 (VS Code):

1. Ouvrir le projet dans VS Code
2. Lancer un serveur statique (ex: Live Server)
3. Ouvrir l URL locale

Option 2 (Python):

1. Se placer dans le dossier du projet
2. Executer:

   python3 -m http.server 5500

3. Ouvrir:

   http://127.0.0.1:5500

## Publier sur GitHub

1. Creer un repository GitHub (ex: NexShare)
2. Initialiser git localement si besoin:

   git init
   git add .
   git commit -m "Initial commit"

3. Connecter le remote et pousser:

   git branch -M main
   git remote add origin https://github.com/nexos20lv/NexShare.git
   git push -u origin main

## Activer GitHub Pages (via Actions)

Ce projet inclut un workflow de deploiement automatique:

- Fichier: .github/workflows/deploy-pages.yml
- Declenchement: push sur la branche main

Dans GitHub:

1. Ouvrir Settings > Pages
2. Dans Build and deployment, choisir Source: GitHub Actions
3. Pousser sur main pour declencher le premier deploiement

Le site sera disponible sur:

https://btmpierre.me/NexShare/

## Notes importantes

- Le P2P necessite que les deux appareils soient connectes en meme temps.
- En environnement file:// certaines API peuvent etre limitees. Preferer un serveur local.
- Si vous utilisez un domaine custom, ajoutez un fichier CNAME a la racine.

## Roadmap

- Relance de transfert simplifiee
- Support meilleur pour sessions longues
- Amelioration UX de reception mobile

## Checklist release

Avant de tagger une nouvelle version:

1. Verifier le flux complet: envoi -> code -> scan QR -> reception -> telechargement.
2. Tester desktop et mobile (au moins Chrome/Edge + Safari mobile).
3. Verifier qu il n y a pas d erreur console bloquante.
4. Mettre a jour le README si une fonctionnalite ou un comportement a change.
5. Pousser sur `main` et verifier le workflow `Deploy to GitHub Pages`.
6. Ouvrir le site deploye et valider un transfert reel entre 2 appareils.

## Licence

MIT (vous pouvez adapter selon votre besoin)
