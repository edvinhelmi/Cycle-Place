UNIVERSITÀ DEGLI STUDI DI TRENTO<br>
Dipartimento di Ingegneria e Scienza dell’Informazione

# **Progetto:** Cycle Place  
**Titolo del documento:** D2 - Sviluppo (Implementazione, Testing e Deployment)  

### Document Info
| Parametro | Dettaglio |
| :--- | :--- |
| **Doc. Name** | D2_CyclePlace_Sviluppo |
| **Doc. Number** | D2 V1.2 |
| **Data Rilascio** | A.A. 2025/2026 |
| **Stato** | Rilasciato / Conforme specifiche UniTN |
| **Autori** | Gruppo Sviluppo Cycle Place |

---

### INDICE
- **Scopo del documento**
- **1. Web APIs**
  - *1.1 Scelte di design e specifiche OAS3*
  - *1.2 Specifica OpenAPI 3.0 (YAML)*
- **2. Implementation**
  - *2.1 Repository Organization*
  - *2.2 Branching strategy e organizzazione del lavoro*
  - *2.3 Dependencies*
  - *2.4 Database e Strutture Dati*
  - *2.5 Testing*
- **3. FrontEnd**
  - *3.1 Architettura e Componenti UI*
  - *3.2 Schermate dell'Applicativo (Figure 1, 2, 3)*
- **4. Deployment e CI/CD**
  - *4.1 Hosting e Pipeline Automatizzata*
  - *4.2 Credenziali di Accesso e Contatti di Supporto*
 
---

## Scopo del documento
Il presente documento riporta in dettaglio tutte le informazioni necessarie all'implementazione e collaudo dell'applicazione web Cycle Place. 
In particolare, formalizza le specifiche contrattuali delle Web API conformi allo standard OpenAPI 3.0, l'organizzazione logica della codebase, la strategia di branching e tracciamento delle attività del team, gli schemi di modellazione dei dati persistenti, il piano formale di collaudo e testing (funzionale e di unità), l'architettura dell'interfaccia Front-End (responsive e multilingua) e, infine, la configurazione operativa della pipeline di Continuous Integration e Continuous Deployment (CI/CD) con le credenziali di accesso per la verifica del sistema deployato.

---

## 1. Web APIs
L'architettura del sistema di backend adotta il paradigma RESTful (Representational State Transfer) sviluppato tramite Node.js ed Express. Lo scambio informativo tra Client e Server è stateless e basato su formati standard JSON e GeoJSON. La protezione delle risorse private avviene mediante l'impiego di token crittografici **JWT (JSON Web Token)**, validati tramite apposito middleware ed inoltrati dal client all'interno dell'header HTTP `Authorization: Bearer <token>`.

Le API sono state formalizzate secondo le specifiche **OpenAPI 3.0**. La documentazione interattiva è accessibile e consultabile all'indirizzo Swagger/Apiary al seguente link:  
**https://cycleplace.docs.apiary.io/#** *(oppure endpoint interno `/api-docs`)*.

### 1.1 Scelte di design delle API
- **Compatibilità Spaziale Real-Time:** L'endpoint `/api/v1/rastrelliere` converte le coordinate territoriali originarie fornite dal Comune di Trento (EPSG:25832) nel sistema convenzionale mondiale WGS84 tramite il motore cartografico `proj4`. Contestualmente, inietta un indicatore telemetrico deterministico per emulare la saturazione degli stalli in tempo reale sulle sole rastrelliere intelligenti (Bloccatelaio).
- **Uniformazione Dati Eterogenei:** L'endpoint `/api/v1/parcheggi` assegna al volo identificativi numerici univoci per consentire l'interazione con il sistema di memorizzazione dei preferiti e l'inoltro di segnalazioni guasti anche sui parcheggi protetti Bici Box.
- **Sicurezza e Protezione da Abusi (RNF 2.5):** Gli endpoint critici per l'autenticazione (`/api/v1/login`, `/api/v1/forgot-password`, `/api/v1/reset-password`) e per le segnalazioni della community sono protetti da rate-limiting dedicati (`express-rate-limit`) per mitigare attacchi a forza bruta o flooding.

### 1.2 Specifica OpenAPI 3.0 (YAML)
Il contenuto del file di specifica contrattuale `oas3.yaml`, depositato nella directory principale del repository, è riportato per esteso di seguito:


```
yaml
openapi: 3.0.0
info:
  version: '1.0.0'
  title: 'Cycle Place Web APIs'
  description: 'API RESTful per la consultazione della rete ciclabile urbana, routing e gestione preferiti/segnalazioni.'
  license:
    name: MIT
servers:
  - url: http://localhost:3000/api/v1
    description: Server Locale di Sviluppo
  - url: [https://cycle-place.onrender.com/api/v1](https://cycle-place.onrender.com/api/v1)
    description: Server Cloud di Produzione

paths:
  /rastrelliere:
    get:
      summary: 'Elenco rastrelliere geolocalizzate'
      description: 'Restituisce la FeatureCollection GeoJSON convertita in WGS84 con telemetria IoT simulata.'
      responses:
        '200':
          description: 'Collezione GeoJSON rastrelliere recuperata con successo.'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GeoJsonCollection'
        '500':
          description: 'Errore interno nel caricamento dei dati spaziali.'

  /parcheggi:
    get:
      summary: 'Elenco parcheggi protetti'
      description: 'Restituisce i parcheggi e box protetti in formato GeoJSON WGS84 con ID univoco normalizzato.'
      responses:
        '200':
          description: 'Dati dei parcheggi recuperati con successo.'

  /register:
    post:
      summary: 'Registrazione nuovo utente'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, surname, email, password]
              properties:
                name: { type: string }
                surname: { type: string }
                email: { type: string, format: email }
                password: { type: string, minLength: 8 }
      responses:
        '201':
          description: 'Utente creato con successo.'
        '400':
          description: 'Parametri mancanti o password non conforme alle policy.'
        '409':
          description: 'Email già presente nel sistema.'

  /login:
    post:
      summary: 'Login locale con email e password'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string }
                password: { type: string }
      responses:
        '200':
          description: 'Accesso eseguito con emissione di Access Token e Refresh Token.'
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken: { type: string }
                  refreshToken: { type: string }
        '401':
          description: 'Credenziali errate.'

  /auth/google:
    post:
      summary: 'Login federato Google SSO'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [credential]
              properties:
                credential: { type: string }
      responses:
        '200':
          description: 'Autenticazione federata convalidata con successo.'
        '401':
          description: 'Token Google non valido o scaduto.'

  /user/preferiti:
    get:
      summary: 'Recupero preferiti utente'
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 'Lista preferiti salvati.'
    post:
      summary: 'Aggiunta elemento ai preferiti'
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [rastrellieraId]
              properties:
                rastrellieraId: { type: integer }
                tipologia: { type: string }
                stalli: { type: integer }
                zona: { type: string }
                lat: { type: number }
                lng: { type: number }
      responses:
        '201':
          description: 'Aggiunto ai preferiti.'
        '409':
          description: 'Elemento già presente nei preferiti.'

  /user/preferiti/{id}:
    delete:
      summary: 'Rimozione preferito per ID'
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 'Elemento rimosso.'

  /segnalazioni:
    post:
      summary: 'Inoltro segnalazione disservizio'
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [rastrellieraId, tipo]
              properties:
                rastrellieraId: { type: integer }
                tipo: { type: string }
                note: { type: string }
                lat: { type: number }
                lng: { type: number }
      responses:
        '201':
          description: 'Segnalazione presa in carico.'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    GeoJsonCollection:
      type: object
      properties:
        type:
          type: string
          example: FeatureCollection
        features:
          type: array
          items:
            type: object
```

**Endpoint Principali (Selezione):**
*   `GET /api/v1/rastrelliere`: (*Pubblica*) Restituisce il censimento delle rastrelliere trasformando (tramite la libreria `proj4`) la proiezione EPSG:25832 nello standard WGS84. Include un micro-servizio che simula e inietta real-time l'occupazione fisica degli stalli IoT.
*   `GET /api/v1/parcheggi`: (*Pubblica*) Inoltra i dati cartografici dei parcheggi protetti Bici Box pronti per essere agganciati alla libreria Leaflet sul frontend. Implementa una logica di *dynamic injection* per assegnare `id` univoci numerici real-time qualora il formato raw originario ne fosse sprovvisto, uniformando così la base dati e abilitando le funzionalità account-linked (Preferiti e Segnalazioni).
*   `POST /api/v1/login`: (*Pubblica*) Riceve un payload contenente email e password, convalida le credenziali ed emette il token JWT se la validazione ha esito positivo.
*   `POST /api/v1/auth/google`: (*Pubblica*) Endpoint federato SSO (Single Sign-On). Riceve il ticket emesso da Google OAuth, lo decodifica per estrapolare la trusted-identity e rilascia il token JWT di sessione.
*   `GET / api/v1/user/preferiti` / `POST /api/v1/user/preferiti`: (*Protetta da JWT*) Gestiscono la consultazione e l'aggiunta di rastrelliere e parcheggi protetti ai preferiti dell'utente.
*   `DELETE /api/v1/user/preferiti/:id`: (*Protetta da JWT*) Rimuove un elemento specifico dalla lista dei luoghi preferiti salvati dall'utente nel proprio profilo.
*   `POST /api/v1/segnalazioni`: (*Protetta da JWT*) Riceve il feedback geolocalizzato dell'utente (es. furto, danni all'infrastruttura), salvandolo a registro con timestamp annesso.
*   `POST /api/v1/register`: (*Pubblica*) Gestisce la registrazione di un nuovo utente validando i campi anagrafici e applicando l'hashing sicuro (bcrypt) alla password.
*   `GET /api/v1/config`: (*Pubblica*) Restituisce le configurazioni pubbliche necessarie al client, inclusa la chiave `googleClientId` per l'inizializzazione del modulo Google SSO.
*   `POST /api/v1/refresh-token`: (*Pubblica*) Riceve il refresh token e genera un nuovo access token JWT valido per estendere la sessione utente.
*   `POST /api/v1/forgot-password`: (*Pubblica*) Invia un link temporaneo di recupero password all'indirizzo email specificato dall'utente.
*   `GET /api/v1/verify-reset-token`: (*Pubblica*) Verifica la validità e la scadenza del token di recupero password prima di consentire il reset.
*   `POST /api/v1/reset-password`: (*Pubblica*) Aggiorna la password dell'utente nel sistema validando il token temporaneo associato.
*   `GET /api/v1/segnalazioni/recenti`: (*Pubblica*) Recupera l'elenco delle segnalazioni recenti inviate dalla community per evidenziare eventuali criticità attive sui marker della mappa.
*   `GET /api/v1/segnalazioni/user`: (*Protetta da JWT*) Restituisce lo storico delle segnalazioni inviate dall'utente all'interno della sua area personale (Dashboard).
*   `PUT /api/v1/user/profile`: (*Protetta da JWT*) Permette l'aggiornamento dei dati anagrafici, delle preferenze di notifica e l'eventuale modifica sicura della password.
*   `DELETE /api/v1/user/account`: (*Protetta da JWT*) Esegue la cancellazione definitiva e irreversibile dell'account e dei dati associati in conformità al GDPR.

---

## 2. Implementation

L'applicazione è stata sviluppata sfruttando le seguenti tecnologie primarie: Node.js ed Express per il layer di backend e persistenza, HTML5/CSS3/JavaScript ES6 per il client SPA, abbinato a Tailwind CSS, DaisyUI e Leaflet.js per la componente UI e geospaziale. La scelta dello stack è maturata dall'esigenza di massimizzare le prestazioni del rendering mappa su dispositivi mobili, evitare overhead infrastrutturali e sfruttare standard cartografici aperti.

### 2.1 Repository Organization

Il codice sorgente del progetto è archiviato nel repository ufficiale GitHub:<br>

https://github.com/edvinhelmi/Cycle-Place.git<br>

La struttura delle cartelle e dei file sorgente è così organizzata:

```text
CyclePlace/
├── data/
│   ├── parcheggi.geojson        
│   ├── rastrelliere.geojson      
│   ├── preferiti.json           
│   ├── segnalazioni.json        
│   └── users.json               
├── docs/
│   ├── design-front-end/
│   │   ├── bloccatelaio.png
│   │   ├── dark_mode.png
│   │   ├── elimina_account.png
│   │   ├── form_segnalazione.png
│   │   ├── loggato.png
│   │   ├── login.png
│   │   ├── navigazione.png
│   │   ├── popup_meteo.jpeg
│   │   ├── popup_nagivazione.png
│   │   ├── profilo.png
│   │   ├── rastrelliera.png
│   │   ├── recupero_password.png
│   │   ├── registrazione.png
│   │   ├── ricerca_negativa.png
│   │   ├── ricerca_positiva.png
│   │   ├── schermata_iniziale.png
│   │   └── segnalazione.png
│   ├── 1.jpg
│   ├── 2.jpg
│   ├── 3.jpg
│   ├── 4.jpg
│   ├── D1_Descrizione_Progetto.md
│   ├── D2_Sviluppo.md
│   └── D4_Report_Finale.md
├── middleware/
│   └── tokenChecker.js          
├── public/                     
│   ├── css/
│   │   ├── dashboard.css       
│   │   ├── style.css            
│   │   └── tailwind.css       
│   ├── js/
│   │   ├── dashboard.js         
│   │   ├── i18n.js             
│   │   └── script.js           
│   ├── dashboard.html          
│   └── index.html              
├── tests/
│   ├── auth.test.js            
│   └── api.test.js              
├── .env.example                 
├── .gitignore                   
├── app.js                      
├── oas3.yaml                   
├── package.json
├── tailwind.config.js              
└── README.md                   
```

### 2.2 Branching strategy e organizzazione del lavoro
La gestione del ciclo di vita del codice ha utilizzato un repository Git ospitato in cloud (GitHub) mediante la metodologia Agile. La strategia di branching scelta si basa sul GitHub Flow: il ramo `main` riflette unicamente lo stato *deployable* (production-ready) del software.
La ripartizione dei contributi e dei commit è tracciata sulla piattaforma GitHub. Le eventuali asimmetrie nel computo numerico dei commit tra i componenti derivano da differenti approcci di raggruppamento (molti commit piccoli per modifiche UI/CSS e modifiche ai documenti a fronte di commit corposi per l'infrastruttura backend e i casi di test).

### 2.3 Dependencies
Il backend del progetto si basa sulle seguenti dipendenze runtime caricate tramite npm:
*   **express**: (Backend) Framework minimalista e flessibile per la creazione del Web Server e il routing logico delle chiamate.
*   **jsonwebtoken**: (Backend) Permette la serializzazione, validazione e scadenza (`exp`) dei token JWT in modo *stateless*.
*   **google-auth-library**: (Backend) Libreria crittografica ufficiale di Google impiegata per il decoding del ticket SSO del login ibrido.
*   **proj4**: (Backend) Componente di cartografia matematica fondamentale per tradurre i tensori da formato UTM a coordinate spaziali convenzionali WGS84.
*   **cors**: (Backend) Middleware strategico vitale per limitare o allentare le direttive di Cross-Origin Resource Sharing.
*   **Tailwind CSS**: (Frontend) Framework utility-first utilizzato per definire rapidamente stili responsivi direttamente nel markup, garantendo consistenza e una codebase CSS minima.
*   **DaisyUI**: (Frontend) Libreria di componenti per Tailwind CSS, utilizzata per lo scaffolding rapido di elementi UI (bottoni, modali, card) preservando pulizia del codice e semantica.
*   **Leaflet.js**: (Frontend) Framework cartografico client-side integrato nativamente su CDN. Consente l'innesto della View Map in HTML5, la gestione del pan/zoom dinamico, e l'overlay dei custom marker e geo-layer.
*   **nodemailer**: Modulo di gestione SMTP per l'inoltro delle comunicazioni transazionali (es. reset password utente).

### 2.4 Database
A causa del ridottissimo I/O rate temporale, il progetto rifiuta il sovradimensionamento di DBMS complessi, prediligendo un approccio leggero orientato agli standard aperti. Le infrastrutture geografiche sono serializzate in formati GeoJSON caricati dal file-system su richiesta dell'Express Server. Per preservare la massima portabilità del prototipo, azzerare le latenze di runtime ed evitare l'overhead di un DBMS esterno dedicato, il sistema memorizza le entità applicative all'interno di file JSON/GeoJSON strutturati:

- **Users** (users.json): Mantiene l'anagrafica utente, il digest della password crittografata con bcrypt, i token di sessione e recupero credenziali.

- **Preferiti** (preferiti.json): Mappatura bidirezionale indicizzata per ID utente (sub) contenente l'elenco dei punti d'interesse salvati

- **Segnalazioni** (segnalazioni.json): Registro delle anomalie territoriali comunicate dalla community con relativo stato di avanzamento..


### 2.5 Testing (FONDAMENTALE)
Il piano di verifica e validazione della piattaforma integra una suite di collaudo automatizzata unita a test funzionali di tipo Black Box, orientati alla verifica puntuale di input, output e stati di sistema.

| Numero | Test Case | Descrizione Test Case | Test Data | Precondizioni | Dipendenze | Risultato Atteso | Risultato Riscontrato |
|:---:|---|---|---|---|---|---|:---:|
| **TC-01** | Creazione account con campi anagrafici vuoti | `name`: "", `email`: "test@local.it", `password`: "123" | Nessuna | Form di registrazione client e backend | Rigetto della transazione con HTTP `400 Bad Request` e feedback d'errore su input. | Positivo | Controllo consistenza minima dati |
| **TC-02** | Creazione account con email duplicata | `email`: "test@local.it", credenziali formattate | Utente già presente nel sistema | Endpoint `POST /api/v1/register` | Il backend intercetta il duplicato, non altera i record e restituisce `409 Conflict`. | Positivo | Verifica vincolo di unicità |
| **TC-03** | Creazione account con violazione policy password | `password`: "123" (minore di 8 caratteri, senza maiuscole o simboli) | Nessuna | Regex sicurezza password | Blocco sottomissione con HTTP `400` ed evidenziazione dei requisiti mancanti. | Positivo | Protezione contro password deboli |
| **TC-04** | *Login formale valido* | Verifica che le credenziali locali formattate correttamente autorizzino il login. | email: "test@local.it", pwd: "123" | L'utente è inserito nel record store. | - | Il server risponde con `200 OK` + Token JWT. Il frontend esegue un re-render della navbar (stato: loggato). | Positivo |
| **TC-05** | *Login errato (Test Negativo)* | Verifica che il sistema prevenga tentativi di furto di identità con credenziali errate. | email: "test@local.it", pwd: "err" | L'utente è registrato e il file è attivo. | - | Il backend ferma la transazione con Status `401 Unauthorized` e notifica l'UI dell'errore. | Positivo |
| **TC-06** | Autenticazione federata tramite Google Sign-In (SSO) | Payload contenente `credential` (Google ID Token firmato) | Google Client ID configurato | Endpoint `POST /api/v1/auth/google` | Decodifica del ticket Google, creazione/riconoscimento utente e rilascio di JWT valido (`200 OK`). | Positivo | Accesso terzo senza password locale |
| **TC-07** | Rinnovo automatico sessione scaduta tramite Refresh Token | Payload: `{ refreshToken attivo nel database | Endpoint `POST /api/v1/refresh-token` | Rilascio di un nuovo Access Token valido per 15 minuti senza forzare il re-login dell'utente (`200 OK`). | Positivo | Persistenza fluida della sessione (RF 1.7) |
| **TC-08** | Richiesta link di recupero password | `email`: "mario.test@unitn.it", `lang`: "it" | Account locale esistente | Endpoint `POST /api/v1/forgot-password` | Generazione token monouso sicuro a 64 caratteri, invio email di ripristino e risposta `200 OK`. | Positivo | Flusso self-service recupero password (RF 1.4) |
| **TC-09** | Impostazione nuova password con token valido | `token`: "<token_esadecimale>", `newPassword`: "Nuova!2026" | Token di reset non scaduto (< 1 ora) | Endpoint `POST /api/v1/reset-password` | Aggiornamento hash bcrypt su `users.json`, invalidazione token usato e risposta `200 OK`. | Positivo | Completamento ciclo ripristino credenziali |
| **TC-10** | Modifica dati anagrafici e cambio password da Dashboard | Payload con nuovo nome, password attuale e nuova password valida | Utente autenticato con Bearer token locale | Endpoint `PUT /api/v1/user/profile` | Verifica password corrente, re-hashing nuova password, emissione JWT aggiornato e risposta `200 OK`. | Positivo | Gestione profilo e sicurezza (RF 3.2, RF 3.3) |
| **TC-11** | Cancellazione definitiva account utente (Diritto all'Oblio GDPR) | Richiesta autenticata con Bearer Token utente | Utente autenticato con preferiti e segnalazioni attive | Endpoint `DELETE /api/v1/user/account` | Rimozione fisica dell'utente da `users.json` e bonifica a cascata di preferiti e segnalazioni collegate (`200 OK`). | Positivo | Conformità normativa GDPR (RF 3.4) |
| **TC-12** | *Filtraggio dinamico layer cartografici* | Verifica disattivazione e ricalcolo parziale della mappa (stalli Tradizionali). | Switch: Checkbox disattivata (stato `false`) | La mappa Leaflet è esposta, gli API data sono inglobati. | Servizio Leaflet | I marker `STILI.tradizionale` spariscono all'istante dall'overlay senza dover fare reload della pagina. | Positivo |
| **TC-13** | *Autolocalizzazione GPS* | Verifica la funzionalità del bottone Floating GPS sulla UI Mobile/Desktop. | Azione: Click su bottone "🎯" | Browser HTML5 Geolocation API e consensi utente. | Hardware GPS/Rete | La Viewport esegue un fly-pan morbido, focalizzando le coordinate geolocalizzate al centro esatto dello schermo. | Positivo |
| **TC-14** | Protezione invio segnalazioni da utenti anonimi | Sottomissione payload segnalazione guasto | Utente anonimo (nessun Bearer token) | Middleware `tokenChecker` | Intercettazione richiesta non autenticata e blocco immediato con codice HTTP `401`. | Positivo | Controllo accessi e integrità community |
| **TC-15** | *Ricerca toponomastica spaziale* | Verifica che l'immissione testuale si leghi in modo corretto allo spostamento vettoriale della View. | Input Testo: "Via Roma" | Marker serializzati nel LayerGroup. | OpenStreetMap Nominatim/Geocode | Lo script interpola l'input e lancia una bounding-box sulla zona di "Via Roma", mostrando le sole rastrelliere ivi contenute. | Positivo |
| **TC-16** | Protezione endpoint contro attacchi di forza bruta (Rate Limiter) | Più di 10 tentativi di login consecutivi in meno di 15 minuti | Nessuna | Middleware `express-rate-limit` | Intercettazione delle richieste eccedenti con blocco temporaneo e risposta HTTP `429 Too Many Requests`. | Positivo | Robustezza e sicurezza applicativa (RNF 2.5) |
| **TC-17** | Aggiunta e persistenza preferito | ID stallo: `142`, tipologia: "Bloccatelaio" | Utente autenticato con JWT valido | Endpoint `POST /api/v1/user/preferiti` | HTTP `201`, salvataggio su database e cambio di stato visivo dell'icona (cuore pieno). | Positivo | Sincronizzazione profilo |
| **TC-18** | *Rimozione rastrelliera preferita* | Verifica la cancellazione di un preferito dall'area profilo utente. | ID Rastrelliera target | Utente autenticato con almeno un preferito attivo. | Endpoint `DELETE /api/v1/user/preferiti/:id` | Il server risponde con `200 OK`, il record viene rimosso dal database e i marker sulla mappa si aggiornano rimuovendo lo stato attivo. | Positivo |

---

## 3. FrontEnd

L'interfaccia utente è stata concepita come una Single Page Application (SPA) reattiva, orientata ai principi del design Mobile-First e all'alta leggibilità delle informazioni cartografiche. La logica dell'interfaccia, organizzata all'interno del file public/js/script.js, implementa un'architettura MVC (Model-View-Controller) client-side:

- Model: I dati GeoJSON delle rastrelliere e dei parcheggi, uniti allo stato in memoria della sessione, dei preferiti e delle coordinate dell'utente.
- View: La composizione del DOM HTML5, integrata con il layer grafico responsive fornito da Tailwind CSS, i componenti di DaisyUI e i contenitori mappa generati dinamicamente da Leaflet.js.
- Controller: La gestione degli Event Listener (click, submit, touch events), l'orchestrazione delle chiamate asincrone (fetch), la manipolazione delle modali e la geolocalizzazione turn-by-turn.

Il front-end include inoltre un motore dedicato di internazionalizzazione client-side (i18n.js) che supporta il passaggio istantaneo e sincrono tra tre lingue: Italiano (IT), Inglese (EN) e Tedesco (DE).

---

## 4. Deployment & CI-CD

L'impianto software poggia su uno stack automatizzato di **Continuous Integration e Continuous Deployment (CI/CD)** essenziale per abbattere l'attrito dei rilasci manuali e garantire standard qualitativi rigidi. 
La colonna portante della CI è delegata a **GitHub Actions**: all'apertura di ogni Pull Request ed a ogni Push formale sul branch `main`, il sistema innesca una pipeline virtualizzata. Essa intercetta preventivamente le *regression* eseguendo gli **Unit Test** formali creati mediante il motore *Jest*. 
Una volta evasi tutti i task verdi della CI, entra in gioco il processo di Delivery. Lo strumento di infrastruttura cloud PaaS selezionato dal team (es. **Render** o **Heroku**) è ancorato al repository git via Webhook. Intercettata la build sana, il cloud-node orchestra internamente il task isolando un container in esecuzione Linux, avvia il processo di fetching via `npm install`, lancia il main daemon Node.js e rende operativi i certificati SSL per esporre all'esterno, in HTTPS, la Web App in modo completamente automatizzato.
