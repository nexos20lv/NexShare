<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&amp;color=0:7b2cbf,100:c77dff&amp;height=200&amp;section=header&amp;text=NexShare&amp;fontSize=65&amp;fontAlignY=40&amp;animation=twinkling&amp;desc=Transfert%20de%20Fichiers%20P2P%20Ultra-Rapide%20via%20WebRTC&amp;descAlignY=60&amp;descAlign=50&amp;fontColor=ffffff" alt="NexShare Banner" />

  <p align="center">
    <a href="https://btmpierre.me/NexShare/">
      <img src="https://img.shields.io/badge/Live_Demo-btmpierre.me%2FNexShare-7b2cbf?style=for-the-badge&amp;logo=firefox&amp;logoColor=white" alt="Live Demo" />
    </a>
    <img src="https://img.shields.io/badge/WebRTC-P2P_Direct-333333?style=for-the-badge&amp;logo=webrtc&amp;logoColor=white" alt="WebRTC" />
    <img src="https://img.shields.io/badge/No_Server_Storage-100%25_Private-2ECC71?style=for-the-badge" alt="Privacy" />
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
  </p>

  <p align="center">
    <b>Partagez des fichiers de n'importe quelle taille directement d'appareil à appareil, sans passer par un serveur intermédiaire.</b>
  </p>
</div>

---

## 📖 À propos de NexShare

**NexShare** est une application web moderne et futuriste de partage de fichiers en Peer-to-Peer (P2P). En s'appuyant sur le protocole **WebRTC DataChannel**, vos données sont transférées directement entre l'expéditeur et le destinataire avec le débit maximal admissible par votre connexion internet.

---

## ✨ Fonctionnalités Principales

- ⚡ **Transfert P2P Direct :** Fichiers transmis en direct sans stockage temporaire sur serveur cloud. Pas de limite de taille de fichier !
- 🔐 **Confidentialité Totale :** Vos fichiers restent privés. La connexion est chiffrée de bout en bout par WebRTC (DTLS/SRTP).
- 📲 **Connexion Rapide par QR Code & Code Court :** Génération automatique d'un QR code et d'un identifiant à 6 chiffres pour appairer les appareils instantanément.
- 🎨 **Interface Futuriste & Dark Mode :** Design réactif, animations fluides et thématique sombre violette.
- 🌐 **Zéro Installation :** Fonctionne directement dans tous les navigateurs modernes (Chrome, Firefox, Safari, Edge, Mobile).

---

## 🚀 Démo en Ligne

Testez directement l'application sur le serveur de démonstration :
👉 **[https://btmpierre.me/NexShare/](https://btmpierre.me/NexShare/)**

---

## 🛠️ Stack Technique

- **Frontend :** HTML5, CSS3 Vanilla (Design customisé), JavaScript ES6+
- **Protocole P2P :** WebRTC DataChannel API
- **Appairage :** Serveur de signalement WebSockets léger pour l'échange d'offres SDP/ICE
- **Génération QR Code :** QRCode.js

---

## ⚙️ Lancement Local

1. Clonez le dépôt git :
   ```bash
   git clone https://github.com/nexos20lv/NexShare.git
   cd NexShare
   ```
2. Lancez un serveur web local (par exemple avec VS Code Live Server ou Python) :
   ```bash
   python3 -m http.server 8080
   ```
3. Ouvrez `http://localhost:8080` sur vos appareils et commencez à transférer !

---

## 📄 Licence

Projet distribué sous licence **MIT**. Consulter [LICENSE](LICENSE) pour plus d'informations.