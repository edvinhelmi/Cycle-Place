# 🚀 Guida alla Messa Online e Deploy di Cycle Place

Questa guida descrive i requisiti architetturali, i passaggi operativi e le migliori pratiche di sicurezza per pubblicare **Cycle Place** su internet in ambiente di produzione.

---

## 📋 Indice
1. [Requisiti e Architettura](#requisiti-e-architettura)
2. [Variabili d'Ambiente di Produzione (.env)](#variabili-dambiente-di-produzione-env)
3. [Configurazione Google OAuth 2.0 (SSO)](#configurazione-google-oauth-20-sso)
4. [Opzioni di Hosting Consigliate](#opzioni-di-hosting-consigliate)
   - [Opzione A: Vercel (Deploy Serverless Gratuito & Rapido)](#opzione-a-vercel-deploy-serverless-gratuito--rapido)
   - [Opzione B: Render / Railway (PaaS a Container Persistente)](#opzione-b-render--railway-paas-a-container-persistente)
   - [Opzione C: VPS Linux (Ubuntu con Nginx e Certbot SSL)](#opzione-c-vps-linux-ubuntu-con-nginx-e-certbot-ssl)
5. [Checklist Finale di Sicurezza](#checklist-finale-di-sicurezza)
6. [Conformità GDPR, Cookie e Privacy](#conformità-gdpr-cookie-e-privacy)

---

## 1. Requisiti e Architettura
- **Node.js**: v18.x o superiore (LTS raccomandata)
- **HTTPS/SSL**: **Obbligatorio** per:
  - Geolocalizzazione browser (`navigator.geolocation` è bloccata dai browser moderni su HTTP non-localhost)
  - Google Identity Services (OAuth 2.0 richiede protocollo HTTPS)
  - Sicurezza dei cookie e dei token JWT in transito
- **Reverse Proxy**: Nginx, Caddy o Cloudflare per terminare la connessione TLS/HTTPS. Express è già configurato con `app.set('trust proxy', 1)`.

---

## 2. Variabili d'Ambiente di Produzione (.env)

In ambiente di produzione, le credenziali **non devono mai essere committate su Git**. Configurale direttamente nel pannello di controllo del tuo provider di hosting (Environment Variables / Secrets).

| Variabile | Descrizione | Esempio Produzione |
|---|---|---|
| `NODE_ENV` | Abilita ottimizzazioni e protezioni | `production` |
| `PORT` | Porta del server HTTP interno | `3000` (o gestita dal provider) |
| `APP_URL` | URL pubblico canonico del sito | `https://cycleplace.it` |
| `ALLOWED_ORIGINS` | Domini autorizzati per il CORS | `https://cycleplace.it,https://www.cycleplace.it` |
| `SUPER_SECRET` | Chiave crittografica per la firma degli Access Token JWT (minimo 256 bit casuali) | Genera con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Chiave crittografica separata per i Refresh Token JWT | Genera una chiave casuale differente |
| `GOOGLE_CLIENT_ID` | Client ID OAuth 2.0 per Google Sign-In | `4559562...apps.googleusercontent.com` |
| `ORS_API_KEY` | Chiave API di OpenRouteService (opzionale: se assente viene usato il motore OSRM gratuito) | `5b3ce35...` |
| `SMTP_HOST` | Host server email per recupero password | `smtp.gmail.com` |
| `SMTP_PORT` | Porta SMTP sicura | `587` |
| `SMTP_USER` | Indirizzo email mittente | `noreply@tuodominio.it` |
| `SMTP_PASS` | Password SMTP o App Password Google | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | Intestazione mittente email | `"Cycle Place" <noreply@tuodominio.it>` |

---

## 3. Configurazione Google OAuth 2.0 (SSO)

Affinché l'accesso con Google funzioni sul dominio pubblico:
1. Accedi alla [Google Cloud Console](https://console.cloud.google.com/).
2. Vai su **API e servizi** > **Credenziali**.
3. Seleziona il tuo **ID client OAuth 2.0** (Applicazione Web).
4. Nella sezione **Origini JavaScript autorizzate**, aggiungi il tuo URL di produzione:
   - `https://tuodominio.it`
   - `https://www.tuodominio.it`
5. Salva le modifiche (possono richiedere fino a 5-10 minuti per propagarsi nei server Google).

---

## 4. Opzioni di Hosting Consigliate

### Opzione A: Vercel (Deploy Serverless Gratuito & Rapido)

Il progetto è preconfigurato per Vercel con [`vercel.json`](file:///Users/edvinhelmi/Desktop/uni/anno2/software/cycle-place/vercel.json) e l'endpoint serverless [`api/index.js`](file:///Users/edvinhelmi/Desktop/uni/anno2/software/cycle-place/api/index.js).

#### Procedura di Deploy su Vercel (via Web):
1. **Pushato il codice su GitHub** (o GitLab / Bitbucket).
2. Accedi a [vercel.com](https://vercel.com) ed effettua l'accesso col tuo account.
3. Clicca su **"Add New..."** > **"Project"** e importa il repository di `cycle-place`.
4. Vercel rileverà automaticamente il progetto. Le impostazioni di build predefinite sono già pronte:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build` (compila il CSS Tailwind minificato)
   - **Output Directory**: automatico (gestito tramite `public/` e rewrites API)
5. Nella sezione **Environment Variables**, aggiungi le variabili essenziali:
   - `SUPER_SECRET`: chiave casuale a 256 bit (generabile con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `JWT_REFRESH_SECRET`: un'altra chiave casuale a 256 bit
   - `GOOGLE_CLIENT_ID`: il tuo client ID Google Cloud
   - `APP_URL`: l'URL generato da Vercel (es. `https://cycle-place.vercel.app`) o il tuo dominio
   - `ALLOWED_ORIGINS`: `https://cycle-place.vercel.app`
   - `ORS_API_KEY`: chiave OpenRouteService (opzionale, altrimenti OSRM gratuito automatico)
   - `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`: credenziali per invio reale email
6. Clicca su **"Deploy"**. Entro circa 30-45 secondi il sito sarà online con certificato **HTTPS valido automatico**!

> [!TIP] **Database Cloud Gratuito con 1 Click (Vercel Postgres / Neon)**
> L'applicazione include già il layer di persistenza ibrido in [`db.js`](file:///Users/edvinhelmi/Desktop/uni/anno2/software/cycle-place/db.js). Per salvare i dati in modo permanente su cloud senza spendere nulla:
> 1. Nella dashboard del progetto su Vercel, clicca sul tab **Storage**.
> 2. Clicca su **Create Database** e scegli **Postgres** (gestito da Neon, 0.5 GB gratuiti per sempre, senza carta di credito).
> 3. Clicca su **Connect to Project** e seleziona `cycle-place`. Vercel inietterà automaticamente `POSTGRES_URL` nelle variabili d'ambiente senza bisogno di copiare nulla a mano.
> 4. Riavvia o fai un nuovo deploy: all'avvio, l'applicazione creerà automaticamente le tabelle `users`, `preferiti` e `segnalazioni`! In locale e nei test `npm test`, l'app continuerà a usare i file JSON velocissimi senza bisogno di toccare nulla.

---

### Opzione B: Render / Railway (PaaS a Container Persistente)
1. Connetti il repository GitHub al provider (es. [Render](https://render.com) o [Railway](https://railway.app)).
2. Configura un **Web Service**:
   - **Build Command**: `npm install && npm run build:css`
   - **Start Command**: `npm start`
3. Nel pannello **Environment Variables**, incolla tutte le variabili descritte nella sezione 2.
4. Se colleghi un dominio personalizzato, attiva il certificato SSL automatico fornito dal provider.

### Opzione C: VPS Linux (Ubuntu + Nginx + PM2 + Let's Encrypt)

#### Passo 1: Installazione Node.js e PM2
```bash
sudo apt update && sudo apt install -y nodejs npm nginx
sudo npm install -g pm2
```

#### Passo 2: Clonazione e configurazione
```bash
git clone https://github.com/tuo-utente/cycle-place.git /var/www/cycle-place
cd /var/www/cycle-place
npm ci
npm run build:css
cp .env.example .env
nano .env # inserisci le credenziali di produzione
```

#### Passo 3: Avvio con PM2 (process manager con riavvio automatico)
```bash
pm2 start app.js --name "cycle-place"
pm2 save
pm2 startup
```

#### Passo 4: Configurazione Reverse Proxy Nginx
Crea il file `/etc/nginx/sites-available/cycle-place`:
```nginx
server {
    server_name tuodominio.it www.tuodominio.it;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Abilita il sito:
```bash
sudo ln -s /etc/nginx/sites-available/cycle-place /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Passo 5: Certificato SSL Gratuito con Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tuodominio.it -d www.tuodominio.it
```

---

## 5. Checklist Finale di Sicurezza

Prima del lancio pubblico, verifica che:
- [x] **Nessun dato personale in Git**: i file `data/users.json`, `data/preferiti.json` e `data/segnalazioni.json` sono esclusi tramite `.gitignore` e inizializzati automaticamente dal server.
- [x] **Header HTTP Difensivi**: Express rimuove `X-Powered-By`, imposta `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy`.
- [x] **Rate Limiting**: attivi limitatori di frequenza per login, registrazione, Google SSO, invio segnalazioni e calcolo percorsi per prevenire attacchi DoS/brute-force.
- [x] **Sanitizzazione Input (Anti-XSS)**: note utente e campi anagrafici sono sanitizzati sia lato client che lato server prima del salvataggio e della visualizzazione.
- [x] **Password Hashing**: crittografia bcrypt a 10 round con salt univoco per tutte le password locali.
- [x] **Robots & Sitemap**: file `/robots.txt` e `/sitemap.xml` configurati per impedire l'indicizzazione degli endpoint interni `/api/`.

---

## 6. Conformità GDPR, Cookie e Privacy
- **Consenso Registrazione**: ogni nuovo utente deve confermare la presa visione dei Termini e dell'Informativa sulla Privacy tramite checkbox dedicata prima di creare un account.
- **Diritto all'Oblio (Art. 17 GDPR)**: ogni utente può cancellare autonomamente il proprio account e tutti i dati a esso collegati con effetto immediato dalla propria Dashboard.
- **Informativa Cookie & Local Storage**: l'applicazione include un banner trasparente che illustra l'utilizzo dei dati tecnici (`localStorage`) senza l'impiego di cookie di profilazione pubblicitaria.
- **Multilingua Legale**: tutti i testi informativi sono disponibili in Italiano, Inglese e Tedesco.
