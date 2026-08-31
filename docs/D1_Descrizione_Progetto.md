# D1 - Descrizione di Progetto: Trento Bike Parking

## 1. Il progetto Trento Bike Parking (Pitch e Scelte Architetturali)

### Introduzione e Pitch
La mobilità ciclabile rappresenta una colonna portante per lo sviluppo urbano sostenibile delle città moderne. Tuttavia, nella città di Trento, molti ciclisti e studenti affrontano quotidianamente ostacoli pratici, primo fra tutti il rischio di furti di biciclette e la conseguente difficoltà a individuare stalli sicuri, o la frustrazione di non sapere in anticipo se la rastrelliera di destinazione è già piena. **Trento Bike Parking** è la soluzione proposta: una Web Application interattiva e responsiva che mappa l'intera rete di rastrelliere e parcheggi sicuri (le cosiddette "Bici box") del Comune di Trento. 
Questa piattaforma offre ai cittadini numerosi vantaggi: consente di pianificare spostamenti sicuri, riduce il tempo di ricerca del parcheggio tramite sistemi di geolocalizzazione, ricerca spaziale e routing, e incentiva attivamente la micro-mobilità. Come attuale limite di sistema, la simulazione dei dati IoT (Internet of Things) sopperisce temporaneamente all'assenza fisica di sensori comunali su larga scala, in attesa di future integrazioni hardware da parte delle amministrazioni locali.

### Scelte Architetturali
Per l'infrastruttura dati, in netta discontinuità con soluzioni pesanti tradizionali, si è scelto di implementare un'architettura **RESTful Node.js stateless** che serve e interroga nativamente file statici **GeoJSON** dal file system (es. `rastrelliere.geojson`), rinunciando volutamente a un database documentale complesso come MongoDB per i dati geospaziali. 
**Motivazione:** I dati strutturali urbani (coordinate di rastrelliere e parcheggi) sono caratterizzati da un *tasso di mutazione quasi nullo* nel breve/medio periodo. Appoggiarsi a un DBMS in questo specifico contesto genererebbe un notevole overhead per operazioni di I/O e queries, e complicherebbe i layer sistemistici. Il caricamento in memoria e la deserializzazione di un GeoJSON garantiscono tempi di risposta estremamente più performanti per le API (`/api/v1/rastrelliere`), risultando la scelta ingegneristica di gran lunga più efficiente ed adeguata al dominio del problema affrontato.

---

## 2. Requisiti Funzionali (RF)

I requisiti funzionali descrivono il dominio del problema, ovvero i servizi che il sistema deve obbligatoriamente fornire all'utenza.

### Utente Anonimo
* **RF3 - Visualizzazione Mappa e Differenziazione Marker:** Il sistema deve mostrare all'utente una mappa interattiva, posizionando dei segnaposto differenziati visivamente per tipologia (es. Rastrelliera Tradizionale, Rastrelliera Bloccatelaio Smart, Parcheggio Protetto).
* **RF4 - Ricerca e Filtri:** Il sistema deve permettere la ricerca tramite testo di vie o piazze e consentire all'utente di filtrare dinamicamente i punti di sosta visualizzati sulla base della loro categoria strutturale.
* **RF5 - Geolocalizzazione GPS:** Il sistema deve, previo consenso, acquisire le coordinate dell'utente e ri-centrare la mappa sulla sua posizione esatta in tempo reale.
* **RF6 - Routing verso Google Maps:** Il sistema deve generare dinamicamente un URI e consentire il reindirizzamento al navigatore esterno (Google Maps) partendo dalle coordinate del parcheggio selezionato.

### Utente Registrato
* **RF1 - Login Ibrido:** Il sistema deve fornire un modulo di autenticazione per consentire l'accesso sia tramite credenziali locali (email e password) sia tramite un provider di identità esterno (Google OAuth).
* **RF2 - Registrazione:** Il sistema deve permettere ad un nuovo utente di creare un profilo personale inserendo i propri dati anagrafici e di sicurezza.
* **RF7 - Dashboard Statistiche:** Il sistema deve consentire all'utente autenticato di accedere ad un'area protetta (Dashboard) in cui consultare informazioni e metriche avanzate del proprio profilo o dei propri parcheggi preferiti.

---

## 3. Requisiti Non Funzionali (RNF)

I requisiti non funzionali dettano i criteri di vincolo architetturale, prestazionale e di usabilità.

* **RNF1 (Compatibilità):** L'applicazione web deve garantire una perfetta renderizzazione e compatibilità per le versioni recenti dei principali browser web commerciali (supporto garantito per Google Chrome >= 90, Mozilla Firefox >= 88, Apple Safari >= 14).
* **RNF2 (Facilità d'uso e Responsività):** L'interfaccia utente deve essere "Mobile First". Il sistema deve riorganizzare l'HUD (Head-up display) su viewport inferiori a `768px` garantendo che nessun elemento a comparsa (es. Menu Hamburger, Pannello Filtri a tendina, Legenda) causi overlap o sovrapposizioni visive che rendano la UI inusabile.
* **RNF3 (Prestazioni):** Per questioni di UX e validazione di sicurezza, il tempo di risposta del sistema, compreso tra l'inserimento della password utente nel form di login e la conferma d'accesso, deve essere strettamente inferiore a **10 secondi**.

---

## 4. Use Case Diagram (Descrizione Testuale)

### Caso d'uso 1: Effettuare il login
* **Attori:** Utente Anonimo.
* **Riassunto:** L'utente accede al proprio profilo sulla piattaforma mediante credenziali o provider esterno.
* **Precondizione:** L'utente ha un account registrato e si trova nell'interfaccia pubblica (home page).
* **Flusso Principale:** 
  1. L'utente seleziona la funzione "Login".
  2. Il sistema mostra il modale di autenticazione.
  3. L'utente compila i campi email e password e clicca "Accedi".
  4. Il sistema verifica i dati.
  5. Il sistema aggiorna l'interfaccia utente (UI) mostrando l'accesso alla dashboard.
* **Postcondizione:** Lo stato dell'utente passa a "Utente Registrato".

### Caso d'uso 2: Cercare parcheggi in una via
* **Attori:** Utente Anonimo, Utente Registrato.
* **Riassunto:** L'utente identifica gli stalli localizzati in un'area d'interesse definita tramite testo.
* **Precondizione:** Il sistema ha terminato di caricare la mappa cartografica e l'aggregato dei marker.
* **Flusso Principale:** 
  1. L'utente focalizza la barra di ricerca spaziale.
  2. L'utente digita un toponimo (es. "Via Belenzani").
  3. L'utente avvia la ricerca.
  4. Il sistema interpreta l'input, applica uno zoom, fa il *panning* della mappa e visualizza esclusivamente i parcheggi prossimi alla via indicata.
* **Postcondizione:** Il *viewport* della mappa copre le coordinate della destinazione inserita e i dati filtrati sono a schermo.

### Caso d'uso 3: Ottenere indicazioni stradali per un parcheggio protetto
* **Attori:** Utente Anonimo, Utente Registrato.
* **Riassunto:** L'utente richiede il calcolo dell'itinerario per raggiungere uno stallo di sicurezza.
* **Precondizione:** L'utente ha individuato visivamente sulla mappa e selezionato con un click (o tap) uno specifico parcheggio protetto.
* **Flusso Principale:** 
  1. Il sistema apre un popup sopra il parcheggio contenente metadati e funzionalità d'azione.
  2. L'utente preme il bottone "Indicazioni".
  3. Il sistema estrapola latitudine e longitudine del target.
  4. Il sistema lancia un evento di reindirizzamento (Routing).
* **Postcondizione:** L'utente viene trasferito alla piattaforma esterna Google Maps con la destinazione pre-compilata.

---

## 5. User Stories

### Epic: Gestione Account
1. **Come** cittadino, **voglio** potermi registrare tramite indirizzo email e password, **in modo da** creare un account sicuro personale per l'utilizzo dell'app.
2. **Come** utente registrato, **voglio** poter fare il login utilizzando il mio account Google OAuth, **in modo da** snellire il processo di autenticazione senza dover gestire un'ulteriore password.

### Epic: Gestione Mappa e Mobilità
3. **Come** ciclista, **voglio** poter filtrare dinamicamente i punti sulla mappa selezionando solo tra rastrelliere tradizionali o parcheggi protetti, **in modo da** eliminare il disordine visivo e trovare subito il tipo di infrastruttura di cui ho bisogno.
4. **Come** ciclista, **voglio** cliccare su un pulsante di geolocalizzazione ("🎯"), **in modo da** far muovere istantaneamente la mappa per mostrare la mia attuale posizione nella città di Trento.
5. **Come** pendolare in mobilità, **voglio** avere a disposizione all'interno delle informazioni del parcheggio un link d'azione diretta ("Indicazioni stradali"), **in modo da** aprire il mio navigatore predefinito ed essere guidato allo stallo.

---

## 6. Design Front-end

La struttura dell'interfaccia utente (UI) si fonda su un pattern "Map-Centric", implementato nativamente tramite il framework **Tailwind CSS** abbinato alla libreria di componenti **DaisyUI**. L'intera applicazione adotta uno stile **Glassmorphism**, caratterizzato da sfondi traslucidi e sfocati (`backdrop-filter: blur(65px)`). 

* **Navbar Superiore:** Un'intestazione (header) permanente e fissa al vertice (z-index elevato), che ospita il branding, il selettore lingua e i tasti rapidi. Su schermi piccoli degenera armoniosamente in un menu "hamburger", che garantisce l'assenza di sovrapposizioni visive quando esteso a tutto schermo.
* **Area Mappa Centrale:** Implementata con layer tile di OpenStreetMap/Leaflet, abbraccia tutto lo schermo. Su di essa "galleggiano" gli altri widget d'interfaccia per massimizzare la percezione dello spazio. Su desktop, i controlli di zoom mantengono lo stile Glassmorphism, mentre su mobile vengono nascosti per favorire le gestures.
* **Barra di Ricerca (Join Component) e Filtri:** La ricerca spaziale è implementata tramite un componente *Join* (input e pulsante fusi assieme) in stile Glassmorphism. I filtri sono ancorati in modo fisso e permanente nell'angolo in alto a destra su desktop, mentre su mobile appaiono tramite un pratico menu a discesa attivabile dalla barra di ricerca stessa.
* **Cruscotto delle Statistiche:** Posizionato centralmente a fondo schermo (bottom-center). Costituito da card traslucide e bordi smussati in cui vengono renderizzati in tempo reale i contatori numerici globali o parziali dei posti liberi, progettati in modo responsivo per evitare troncamenti di testo.
* **Design dei Popup UI:** Alla pressione di un marker, sorge un tooltip (Popup UI) in stile Glassmorphism. L'interno espone metriche dettagliate e, oltre al link di routing, include bottoni d'azione interattivi basati su DaisyUI per l'aggiunta rapida ai **Preferiti** e l'apertura del modale di **Segnalazione Problema** (sia per rastrelliere che per parcheggi protetti).

---

## 7. User Flow

### Flusso 1: Ricerca, geolocalizzazione e routing verso lo stallo
1. **Avvio:** L'utente apre l'applicazione via browser. La mappa si carica, i pin vengono renderizzati.
2. **Posizionamento GPS:** L'utente, per focalizzare il contesto circostante, preme il bottone GPS situato in basso a sinistra. Il browser richiede i permessi; se accordati, la mappa si centra sull'utente.
3. **Restrizione Visiva:** L'utente estende il menu a tendina "Filtri" e deseleziona le rastrelliere tradizionali per focalizzarsi sui "Parcheggi protetti".
4. **Ricerca Cartografica:** Notando uno stallo di interesse a qualche isolato di distanza, vi clicca/tocca sopra.
5. **Apertura Metadati:** Si attiva l'evento: la mappa esegue un pan (micro-spostamento animato) per inquadrare bene il popup che emerge sullo schermo.
6. **Routing Ext:** L'utente consulta il numero di posti e, soddisfatto, esegue il tap sul bottone interno "📍 Indicazioni".
7. **Conclusione:** Una nuova tab si apre sul device instradando l'utente alla cartografia di Google Maps in modalità calcolo percorso attivato.

### Flusso 2: Autenticazione e visualizzazione Dashboard
1. **Avvio:** L'utente accede all'app e intende controllare il proprio profilo.
2. **Accesso form:** L'utente identifica la Navbar e preme il pulsante "Login". 
3. **Interazione modale:** Un layer semi-trasparente sfuoca la mappa di background, ed emerge al centro un box di autenticazione ibrida.
4. **Inserimento:** L'utente digita "email" e "password" classiche nel form formattato ad-hoc, per poi inviare il *submit*.
5. **Validazione:** Il backend verifica (tempo netto < 10 secondi, come da vincolo RNF3) la conformità del payload.
6. **Cambio di Stato UI:** L'esito è positivo. Il modale di login collassa. In modo invisibile la navbar effettua il binding reattivo e nasconde il bottone di Login/Registrazione, sostituendoli con un nuovo pulsante "Dashboard" e il saluto ("Ciao, Utente").
7. **Conclusione:** L'utente clicca su "Dashboard" venendo reindirizzato al file `dashboard.html`, ove godrà dei pieni privilegi del suo ruolo.
