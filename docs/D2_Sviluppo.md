# D2 - Sviluppo (Implementazione e Testing)

## Scopo del documento
Il presente documento descrive in dettaglio le fasi di implementazione, architettura e collaudo della piattaforma web "Cycle Place". Riporta inoltre le specifiche delle interfacce API, l'organizzazione della *codebase*, la pipeline di testing formale e le procedure di Deployment (CI/CD) adottate dal team di sviluppo.

---

## 1. Web APIs

L'architettura del sistema di comunicazione segue fedelmente il paradigma **RESTful** (Representational State Transfer) sviluppato tramite Node.js ed Express. La connessione Client-Server avviene in modo totalmente *stateless*, scambiando esclusivamente formati dati nativi JSON e GeoJSON. L'integrità e la protezione delle rotte autorizzative private avvengono sfruttando un token crittografico standard, il **JWT (JSON Web Token)**, iniettato in formato Bearer negli header delle richieste.

**Endpoint Principali (Selezione):**
*   `GET /api/v1/rastrelliere`: (*Pubblica*) Restituisce il censimento delle rastrelliere trasformando (tramite la libreria `proj4`) la proiezione EPSG:25832 nello standard WGS84. Include un micro-servizio che simula e inietta real-time l'occupazione fisica degli stalli IoT.
*   `GET /api/v1/parcheggi`: (*Pubblica*) Inoltra i dati cartografici dei parcheggi protetti Bici Box pronti per essere agganciati alla libreria Leaflet sul frontend. Implementa una logica di *dynamic injection* per assegnare `id` univoci numerici real-time qualora il formato raw originario ne fosse sprovvisto, uniformando così la base dati e abilitando le funzionalità account-linked (Preferiti e Segnalazioni).
*   `GET /api/v1/weather/alerts`: (*Pubblica*) Interroga in tempo reale il servizio meteo esterno (Open-Meteo) per rilevare condizioni di allerta severa e pilotare l'attivazione dinamica del banner di avviso in-app.
*   `POST /api/v1/login`: (*Pubblica*) Riceve un payload contenente email e password, convalida le credenziali ed emette il token JWT se la validazione ha esito positivo.
*   `POST /api/v1/auth/google`: (*Pubblica*) Endpoint federato SSO (Single Sign-On). Riceve il ticket emesso da Google OAuth, lo decodifica per estrapolare la trusted-identity e rilascia il token JWT di sessione.
*   `POST /api/v1/user/preferiti`: (*Protetta da JWT*) Registra o aggiunge uno specifico ID parcheggio/rastrelliera alla lista dei preferiti legati all'account identificato dal payload del token JWT.
*   `DELETE /api/v1/user/preferiti/:id`: (*Protetta da JWT*) Rimuove un elemento specifico dalla lista dei luoghi preferiti salvati dall'utente nel proprio profilo.
*   `POST /api/v1/segnalazioni`: (*Protetta da JWT*) Riceve il feedback geolocalizzato dell'utente (es. furto, danni all'infrastruttura), salvandolo a registro con timestamp annesso.

---

## 2. Implementation

### 2.1 Repository Organization
La codebase del progetto abbraccia il principio base della segregazione delle responsabilità (SoC):
- Il kernel del server (`app.js`), i configuration file (es. `package.json`, `.env`) popolano la root directory e governano l'inizializzazione del software.
- Tutti i moduli funzionali di supporto sono archiviati logicamente (es. folder `/middleware/` per la validazione token, `/data/` per lo storage passivo).
- L'intera SPA (Single Page Application) frontend (asset, HTML, fogli di stile CSS, moduli DOM interattivi) risiede all'interno della cartella segregata `public/`, agendo unicamente come cartella di esposizione (static serving) per il client.

### 2.2 Branching strategy e organizzazione del lavoro
La gestione del ciclo di vita del codice ha utilizzato un repository Git ospitato in cloud (GitHub) mediante la metodologia **Agile**. La strategia di branching scelta si basa sul **GitHub Flow**: il ramo `main` riflette unicamente lo stato *deployable* (production-ready) del software. Ogni sviluppatore del team ha operato isolatamente in branch secondari ramificati per *Feature* (es. `feature/google-login`, `fix/mobile-z-index`), e il processo di fusione verso il tronco primario avveniva esclusivamente via Pull Request (PR), sottomesse a validazione e Code Review incrociata.

### 2.3 Dependencies
Le librerie principali che hanno consentito lo sviluppo rapido e sicuro del sistema sono (evinte dal file `package.json` e header client):
*   **express**: (Backend) Framework minimalista e flessibile per la creazione del Web Server e il routing logico delle chiamate.
*   **jsonwebtoken**: (Backend) Permette la serializzazione, validazione e scadenza (`exp`) dei token JWT in modo *stateless*.
*   **google-auth-library**: (Backend) Libreria crittografica ufficiale di Google impiegata per il decoding del ticket SSO del login ibrido.
*   **proj4**: (Backend) Componente di cartografia matematica fondamentale per tradurre i tensori da formato UTM a coordinate spaziali convenzionali WGS84.
*   **cors**: (Backend) Middleware strategico vitale per limitare o allentare le direttive di Cross-Origin Resource Sharing.
*   **Tailwind CSS**: (Frontend) Framework utility-first utilizzato per definire rapidamente stili responsivi direttamente nel markup, garantendo consistenza e una codebase CSS minima.
*   **DaisyUI**: (Frontend) Libreria di componenti per Tailwind CSS, utilizzata per lo scaffolding rapido di elementi UI (bottoni, modali, card) preservando pulizia del codice e semantica.
*   **Leaflet.js**: (Frontend) Framework cartografico client-side integrato nativamente su CDN. Consente l'innesto della View Map in HTML5, la gestione del pan/zoom dinamico, e l'overlay dei custom marker e geo-layer.

### 2.4 Database
A causa del ridottissimo I/O rate temporale (modificare uno stallo strutturale o l'asset di un parcheggio cittadino richiede mesi), il progetto rifiuta il sovradimensionamento causato da complessi DBMS come MongoDB, prediligendo un approccio leggero su standard cartografico open. Le infrastrutture sono state serializzate in formati puramente testuali **GeoJSON** caricati dal file-system su richiesta dell'Express Server. Persino gli attributi utente e di reportistica (segnalazioni/preferiti) sono implementati programmaticamente (JSON-file store) per mantenere le latenze allo zero logico e massimizzare la facilità di deployment in ambienti containerizzati in questa prima versione prototipale.

### 2.5 Testing (FONDAMENTALE)
A garanzia dell'affidabilità del sistema, è stata effettuata un'Analisi Funzionale del layer applicativo secondo il paradigma logico di ispezione **Black Box Testing**, non curandosi della logica interna ma validando il perimetro tra l'input e l'output generato dal sistema.

| Numero | Test Case | Descrizione Test Case | Test Data | Precondizioni | Dipendenze | Risultato Atteso | Risultato Riscontrato |
|:---:|---|---|---|---|---|---|:---:|
| **TC-01** | *Login formale valido* | Verifica che le credenziali locali formattate correttamente autorizzino il login. | email: "test@local.it", pwd: "123" | L'utente è inserito nel record store. | - | Il server risponde con `200 OK` + Token JWT. Il frontend esegue un re-render della navbar (stato: loggato). | Positivo |
| **TC-02** | *Login errato (Test Negativo)* | Verifica che il sistema prevenga tentativi di furto di identità con credenziali errate. | email: "test@local.it", pwd: "err" | L'utente è registrato e il file è attivo. | - | Il backend ferma la transazione con Status `401 Unauthorized` e notifica l'UI dell'errore. | Positivo |
| **TC-03** | *Filtraggio dinamico layer* | Verifica disattivazione e ricalcolo parziale della mappa (stalli Tradizionali). | Switch: Checkbox disattivata (stato `false`) | La mappa Leaflet è esposta, gli API data sono inglobati. | Servizio Leaflet | I marker `STILI.tradizionale` spariscono all'istante dall'overlay senza dover fare reload della pagina. | Positivo |
| **TC-04** | *Autolocalizzazione GPS* | Verifica la funzionalità del bottone Floating GPS sulla UI Mobile/Desktop. | Azione: Click su bottone "🎯" | Browser HTML5 Geolocation API e consensi utente. | Hardware GPS/Rete | La Viewport esegue un fly-pan morbido, focalizzando le coordinate geolocalizzate al centro esatto dello schermo. | Positivo |
| **TC-05** | *Protezione Segnalazioni (Bound. Case)*| Verifica che un Utente Anonimo non possa spammare segnalazioni. | Payload dummy di segnalazione | Stato Utente: Logout / Non autorizzato. | API Router `/api/v1/segnalazioni` | Il Middleware intercetta assenza di token Bearer e blocca (drop) il pacchetto con HTTP 401. | Positivo |
| **TC-06** | *Ricerca toponomastica spaziale* | Verifica che l'immissione testuale si leghi in modo corretto allo spostamento vettoriale della View. | Input Testo: "Via Roma" | Marker serializzati nel LayerGroup. | OpenStreetMap Nominatim/Geocode | Lo script interpola l'input e lancia una bounding-box sulla zona di "Via Roma", mostrando le sole rastrelliere ivi contenute. | Positivo |
| **TC-07** | *Rimozione rastrelliera preferita* | Verifica la cancellazione di un preferito dall'area profilo utente. | ID Rastrelliera target | Utente autenticato con almeno un preferito attivo. | Endpoint `DELETE /api/v1/user/preferiti/:id` | Il server risponde con `200 OK`, il record viene rimosso dal database e i marker sulla mappa si aggiornano rimuovendo lo stato attivo. | Positivo |

---

## 3. FrontEnd

Il front-end è stato architettato come un ibrido ad elevate prestazioni nel panorama **Web 2.0 SPA**. A livello strutturale e logico (file `script.js`), l'ingegnerizzazione emula il pattern **MVC (Model-View-Controller)** client-side: le richieste fetch/XHR formano il Model (costruendo array di dizionari JS), l'albero del DOM funge da View e l'Event Loop dei file JS (gestendo toggle e form-handler) risiede nella carica di Controller.

Sul fronte Design System, la Web App attinge ai dogmi UI **Mobile-first** mediante un'integrazione radicale e nativa di **Tailwind CSS e DaisyUI**. Per scongiurare conflitti di spazio o problemi di rendering multi-risoluzione (tipico fattore limitante su mobile viewport), la Navbar migra organicamente verso un Hamburger Menu integrato, le card d'informazione adottano posizionamenti relativi governati dallo Z-Index e la barra di ricerca sfrutta il pattern componentistico "Join" per compattare gli input utente. 
La logica delle finestre modali è gestita programmaticamente manipolando le classi di stato di DaisyUI (es. toggle tra `.hidden` e `.modal-open`). L'intero ecosistema grafico abbraccia la filosofia del *Glassmorphism* (filtri di sfocatura dello sfondo e trasparenze).

Il core cartografico, affidato interamente a **Leaflet**, vanta l'iniezione programmatica di marker vettoriali dinamici: all'evento `onClick`, scaturisce il rendering di un *popup UI* intelligente, dotato di bottoni interattivi (inserimento preferiti, form di segnalazione problemi) e di una "Call-To-Action" per il calcolo avanzato del Routing geo-spaziale in-app tramite l'integrazione di **OpenRouteService**. 
I controlli stessi della mappa sono reattivi (UI responsive): su desktop sono renderizzati con temi Glassmorphism, mentre su mobile sono interamente off-screen per massimizzare la percezione touch (Pinch-to-zoom).

---

## 4. Deployment & CI-CD

L'impianto software poggia su uno stack automatizzato di **Continuous Integration e Continuous Deployment (CI/CD)** essenziale per abbattere l'attrito dei rilasci manuali e garantire standard qualitativi rigidi. 
La colonna portante della CI è delegata a **GitHub Actions**: all'apertura di ogni Pull Request ed a ogni Push formale sul branch `main`, il sistema innesca una pipeline virtualizzata. Essa intercetta preventivamente le *regression* eseguendo gli **Unit Test** formali creati mediante il motore *Jest*. 
Una volta evasi tutti i task verdi della CI, entra in gioco il processo di Delivery. Lo strumento di infrastruttura cloud PaaS selezionato dal team (es. **Render** o **Heroku**) è ancorato al repository git via Webhook. Intercettata la build sana, il cloud-node orchestra internamente il task isolando un container in esecuzione Linux, avvia il processo di fetching via `npm install`, lancia il main daemon Node.js e rende operativi i certificati SSL per esporre all'esterno, in HTTPS, la Web App in modo completamente automatizzato.
