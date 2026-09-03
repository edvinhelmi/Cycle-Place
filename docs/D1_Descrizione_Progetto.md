UNIVERSITÀ DEGLI STUDI DI TRENTO
Dipartimento di Ingegneria e Scienza dell’Informazione

## Progetto: Cycle-Place
## Titolo del documento: Descrizione di Progetto

---

Document Info
Doc. Name: D1-cycle-place-DescrizioneProgetto
Doc. Number: D1 v1.2
Description: Documento di analisi dei requisiti funzionali, non funzionali, use case, user story e design front-end per l'applicazione Cycle-Place.

---

INDICE
1. Il progetto Cycle-Place
2. Requisiti Funzionali
3. Requisiti Non Funzionali
4. Use Case Diagram
5. User Story
6. Design Front-end

---

## 1. Il progetto Cycle Place (Pitch e Scelte Architetturali)

#### *********************** INSERIRE SLIDES ***********************

Il presente progetto mira ad affrontare la problematica della scarsa propensione degli individui all'utilizzo della bicicletta per gli spostamenti abituali, nonostante i numerosi benefici che il suo uso regolare può apportare alla salute ed il suo ruolo chiave nella promozione di una mobilità sostenibile. 
Attualmente, molti potenziali ciclisti rinunciano a spostarsi in bicicletta a causa di ostacoli esterni, come per esempio la mancanza di parcheggi sicuri e accessibili, il potenziale rischio di furto e una più generale carenza di infrastrutture dedicate, che contribuiscono a una percezione diffusa di insicurezza. 
Questa dinamica viene evidenziata dai dati pubblicati dall'Istituto Superiore della Sanità nel biennio 2023-2024 all'interno del progetto PASSI, dai quali emerge che, nonostante le città di Trento e Bolzano mostrino un uso superiore alla media nazionale, la percentuale di adulti che utilizza abitualmente la bicicletta rimane ancora limitata. Ulteriori riscontri emergono dai dati ISPAT sulla mobilità sostenibile, dal Piano mobilità ciclistica Alto Adige 2022 e dal Piano degli Spostamenti Casa-Lavoro (PSCL) 2025.
Il progetto ha come obiettivo la realizzazione di una web app, Cycle-Place, finalizzata a promuovere l'adozione quotidiana della bicicletta. L'applicazione si rivolge a tutti i cittadini, offrendo uno strumento semplice e immediato per pianificare la sosta ed interagire con la community. 

Le funzionalità principali dell'applicazione sono state definite per risolvere direttamente questi problemi e includono:
- Localizzazione su mappa delle aree di sosta, visualizzazione delle caratteristiche della sosta (tipologia, numero stalli, zona) e possibilità di filtrare per modello di rastrelliera (es. bloccatelaio vs tradizionale).
- Sistema Community-based (Preferiti e Segnalazioni): Gli utenti registrati possono salvare i propri parcheggi abituali e inviare segnalazioni (es. rastrelliera danneggiata, area insicura).
- Pianificazione Percorsi (Routing): Integrazione In-App con OpenRouteService per calcolare tragitti ciclabili o pedonali dalla posizione attuale al parcheggio scelto.
- Funzioni secondarie quali informazioni meteo per aiutare l'utente a pianificare il proprio tragitto.

### Vantaggi per il Comune:
- Sostegno alla mobilità sostenibile: l'applicazione stimola l'uso quotidiano della bicicletta, contribuendo alla riduzione del traffico e delle emissioni inquinanti.
- Supporto alla pianificazione urbana: le segnalazioni degli utenti e i dati raccolti offrono informazioni sempre aggiornate per la progettazione di interventi infrastrutturali più efficaci, supportando strategie come il PSCL 2025.
- Economicità, integrabilità e scalabilità: si tratta di una soluzione a basso costo implementativo rispetto ad interventi fisici strutturali, progettata per integrarsi con i servizi esistenti.

### Vantaggi per gli utenti:
- Partecipazione attiva alla qualità del servizio: la possibilità di segnalare punti poco sicuri e tipologie di sosta consente di contribuire direttamente al miglioramento dell'esperienza ciclistica cittadina.
- Maggiore sicurezza: individuazione rapida di parcheggi sicuri e disponibilità di un canale immediato per la segnalazione dei problemi riscontrati.
- Esperienza d’uso intuitiva: un’interfaccia semplice e funzionalità mirate rendono l’app accessibile a tutti, promuovendo un utilizzo naturale e frequente.

### Limiti dell'applicazione:
- Partecipazione costante: la qualità delle mappe e delle segnalazioni dipende dalla partecipazione attiva della community, soprattutto nelle fasi iniziali.
- Copertura territoriale variabile: nelle aree meno frequentate o extraurbane, la disponibilità di dati potrebbe essere limitata.
- Requisiti tecnologici e connessione: l'app richiede uno smartphone e una connessione internet stabile, escludendo potenzialmente categorie di cittadini non digitalizzati.
- Richiede investimenti iniziali: sono necessari per lo sviluppo e la configurazione della piattaforma, l'acquisizione e validazione dei dati sulle aree di sosta, e per garantire l'integrazione con i sistemi informativi esistenti. A queste voci si aggiungono le attività di formazione del personale sull'utilizzo degli strumenti di gestione delle segnalazioni.

---

## 2. Requisiti Funzionali (RF)

### RF 1 - Gestione autenticazione
- **RF 1.1 - Accesso anonimo**: Il sistema deve permettere la visualizzazione della mappa interattiva delle aree di sosta (filtrabili per tipologia) e delle iniziative del comune senza richiedere autenticazione.
- **RF 1.2 - Registrazione**: Il sistema deve permettere la creazione di un account tramite email valida, nome, cognome e una password che soddisfi criteri di complessità. 
- **RF 1.3 - Accesso utente registrato**: Autenticazione tramite credenziali locali (email e password) o tramite credenziali Google (OAuth 2.0).
- **RF 1.4 - Flusso di autenticazione esterna**: Gestione del reindirizzamento al provider Google, validazione del token e creazione/associazione automatica del profilo.
- **RF 1.5 - Recupero password**: Funzionalità sicura per il recupero della password tramite link temporaneo via email.
- **RF 1.6 - Logout**: Disinclusione sicura della sessione attiva da qualsiasi dispositivo.
- **RF 1.7 - Gestione della sessione**: Mantenimento della sessione tramite token JWT con supporto per il refresh automatico.
- **RF 1.8 - Invalidazione della sessione**: Il logout o un nuovo login deve invalidare i Refresh Token precedenti, forzando la riautenticazione. 
- **RF 1.9 - Rate Limiting Autenticazione**: Il sistema deve limitare i tentativi di login consecutivi per prevenire attacchi brute-force. 

### RF 2 - Registrazione utente
- **RF 2.1 - Registrazione con credenziali locali** tramite form (Nome, Cognome, email valida, password composta da almeno 8 caratteri di cui almeno 1 numero, una lettera maiuscola ed un carattere speciale).
- **RF 2.2 - Registrazione tramite Google** con importazione automatica dei dati di base.
- **RF 2.3 - Scelta della lingua**: Supporto per italiano, inglese e tedesco.

### RF 3 - Gestione profilo
- **RF 3.1 - Visualizzazione del profilo** (informazioni personali, rastrelliere salvate e segnalazioni effettuate).
- **RF 3.2 - Modifica delle informazioni personali e delle preferenze** (es. notifiche push). (?)??????????????
- **RF 3.3 - Modifica della password**.
- **RF 3.4 - Richiesta di cancellazione definitiva dell'account e dei dati associati** (GDPR).
- **RF 3.5 - Cancellazione definitiva del proprio account e di tutti i dati associati** (preferiti, segnalazioni). 

### RF 4 - Backup e Ripristino
Esecuzione di backup regolari dei dati critici per garantirne il ripristino in caso di guasti.

### RF 5 - Gestione mappa e aree di sosta
- **RF 5.1 - Visualizzazione mappa** centrata sulla posizione GPS dell'utente o sull'area selezionata.
- **RF 5.2 - Visualizzazione delle aree di sosta** distinte per tipologia (rastrelliera, Ciclobox).
- **RF 5.3 - Filtraggio delle aree di sosta per tipologia**.
- **RF 5.4 - Dettaglio area di sosta** tramite popup (tipologia (rastrelliera o ciclobox), numero di stalli, zona, informazioni sullo stato (solo per i Ciclobox), ad es: disponibile/non disponibile, presenza di segnalazioni effettuate da altri utenti).
- **RF 5.5 - Salvataggio e visualizzazione rapida delle aree di sosta preferite**.
- **RF 5.6 - Calcolo del percorso efficiente e sicuro tra due punti**: il sistema deve integrare In-App l'API di OpenRouteService per calcolare e visualizzare sulla mappa il percorso tra la posizione attuale dell'utente (se concessa) e l'area di sosta selezionata.

### RF 6 - Gestione storico utilizzo
Visualizzazione dello storico delle interazioni (segnalazioni inviate, aree salvate).

### RF 7 - Gestione avvisi
Invio di avvisi intelligenti in-app per allerte meteo e aggiornamenti sullo stato delle segnalazioni. ???

******************* qui da vedere **********************************
RF 10 - Gestione dati e interfaccia amministrativa (Lato Comune)
• RF 10.1 - Dashboard amministrativa dedicata agli operatori comunali.
• RF 10.2 - Gestione e filtraggio delle segnalazioni con inserimento di note interne.
• RF 10.3 - Operazioni CRUD ufficiali sulle aree di sosta.
• RF 10.4 - Visualizzazione di dati aggregati, report e statistiche di utilizzo.
• RF 10.5 - Mappatura dei futuri punti di sosta con data di previsione apertura.
• RF 10.6 - Gestione delle iniziative comunali informative.


---

## 3. Requisiti Non Funzionali (RNF)

### RNF 1 - Perfomance
• **RNF 1.1 - Velocità della mappa**: Il caricamento ed il rendering della mappa interattiva deve essere completato entro un massimo di 2 secondi, anche con una connessione mobile media (3G/4G). Nota: le performance dipendono anche dai tempi di risposta dell'API OpenStreetMap.
• **RNF 1.2 Latenza di routing**: Il calcolo del percorso ottimizzato per bici (RF 4) tramite OpenRouteService non deve superare i 5 secondi di elaborazione server, per garantire la fruibilità in movimento.
• **RNF 1.3 - Tempi di risposta API**: Le chiamate alle API del backend (caricamento dati GeoJSON, invio di una segnalazione o richiesta di login) devono completarsi con successo entro 500 millisecondi con un carico medio.
• **RNF 1.4 - Gestione connessione intermittente**: L'applicazione mobile deve mantenere le funzionalità di base (es. visualizzazione di mappe cache o dati dei parcheggi già caricati) anche in assenza temporanea di connessione Internet.

### RNF 2 - Sicurezza e crittografia
• **RNF 2.1 - Autenticazione e Autorizzazione**: Le comunicazioni tra l'app ed il server devono essere crittografate tramite protocolli TLS/SSL (HTTPS). Solo gli utenti autenticati e registrati (verificati tramite JWT) devono essere autorizzati ad inviare segnalazioni e ad accedere allo storico personale.
• **RNF 2.2 - Protezione dati**: Le password degli utenti devono essere archiviate nel database locale tramite hashing sicuro (utilizzando l'algoritmo bcrypt).
• **RNF 2.3 - Protezione dati di geolocalizzazione**: I dati di geolocalizzazione necessari per il routing devono essere trattati nel rispetto della privacy e non memorizzati in modo persistente se non strettamente necessario per le segnalazioni inviate esplicitamente dall'utente.
• **RNF 2.4 - Validazione input e Affidabilità**: Il sistema deve implementare una precisa validazione di tutti gli input utente (form di registrazione, segnalazioni) per prevenire attacchi comuni e implementare rate limiting per limitare lo spam di segnalazioni.

### RNF 3 - Usabilità
• **RNF 3.1 - Design coerente e Reattività**: L'interfaccia utente (UI) deve seguire le linee guida di design moderne (Material Design/Human Interface Guidelines) e rispondere ai gesti touch in modo istantaneo. Il processo di invio di una segnalazione deve essere rapido e intuitivo.

### RNF 4 - Affidabilità e Disponibilità
• **RNF 4.1 - Disponibilità del servizio**: Il back-end e l'API devono garantire un tempo di attività (uptime) pari al 99.5% su base mensile (esclusi gli slot di manutenzione programmati).
• **RNF 4.2 - Durata della sessione**: Dopo il login, l'utente autenticato deve rimanere connesso per un periodo di tempo esteso (30 giorni, gestito tramite Refresh Token JWT), richiedendo un nuovo login solo in caso di logout esplicito o scadenza prolungata.

### RNF 5 - Manutenibilità e Portabilità
• **RNF 5.1 -Modularità, Logging e Standard dei dati**: Il codice sorgente del back-end deve essere strutturato in modo modulare. Il sistema deve implementare un logging degli errori e tutti i dati delle aree di sosta e delle segnalazioni devono essere scambiati nel formato standard GeoJSON.

---

## 4. Use Case Diagram ***************************************** AGGIUNGERE

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
