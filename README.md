# Cycle Place 🚲

Cycle Place è una Web Application interattiva e responsiva che mappa l'intera rete di rastrelliere e parcheggi sicuri (Bici Box) del Comune di Trento.
Il progetto offre una mappa cartografica interattiva, funzioni di geolocalizzazione, navigazione live Turn-by-Turn in-app con guida vocale multilingua (IT/EN/DE), un sistema di ricerca spaziale, e permette agli utenti (tramite account locale o Google OAuth) di salvare i propri parcheggi preferiti e inviare segnalazioni di guasti o problemi.

## Tecnologie Utilizzate
*   **Backend:** Node.js, Express, JSON Web Token (JWT), OpenRouteService Proxy
*   **Frontend:** HTML5, JavaScript (Vanilla), Tailwind CSS, DaisyUI, Web Speech API (TTS)
*   **Mappa & Dati:** Leaflet.js, OpenStreetMap, GeoJSON, proj4

---

## 🛠 Come avviare il progetto in locale (Localhost)

Per avviare il progetto sul tuo computer, assicurati di avere installato **[Node.js](https://nodejs.org/)**. 
Scegli le istruzioni corrispondenti al tuo sistema operativo:

### 🍎 Istruzioni per Mac / Linux

1. **Scarica il progetto e accedi alla cartella:**
   ```bash
   git clone https://github.com/edvinhelmi/trento-bike-parking.git
   cd trento-bike-parking
   ```

2. **Installa le dipendenze:**
   ```bash
   npm install
   ```

3. **Avvia il Server:**
   ```bash
   npm start
   ```

4. **Apri l'app:**
   Apri il tuo browser preferito e vai all'indirizzo: **`http://localhost:3000`**

*(Nota: il progetto è configurato in modalità Plug&Play. Non è necessario configurare alcun file `.env` o chiavi API per testare tutte le funzionalità — inclusi percorsi bici/pedonali, navigazione live e login Google — in locale).*

---

### 🪟 Istruzioni per Windows

1. **Scarica il progetto e accedi alla cartella:**
   Apri il Prompt dei Comandi (cmd) o PowerShell ed esegui:
   ```cmd
   git clone https://github.com/edvinhelmi/trento-bike-parking.git
   cd trento-bike-parking
   ```

2. **Installa le dipendenze:**
   ```cmd
   npm install
   ```

3. **Avvia il Server:**
   ```cmd
   npm start
   ```

4. **Apri l'app:**
   Apri il tuo browser preferito e vai all'indirizzo: **`http://localhost:3000`**

*(Nota: il progetto è configurato in modalità Plug&Play. Non è necessario configurare chiavi API o file .env per testare il login tramite Google in locale).*

---

### 💡 Note per gli Sviluppatori (CSS & Tailwind)
L'interfaccia utente è stilizzata tramite Tailwind CSS e i componenti DaisyUI. Il file CSS finale (`public/css/tailwind.css`) è già generato e incluso nel repository.
Tuttavia, se decidi di **modificare il codice HTML o aggiungere nuove classi CSS**, ricordati di ricompilare il file Tailwind eseguendo il seguente comando nel terminale:

```bash
npm run build:css
```
