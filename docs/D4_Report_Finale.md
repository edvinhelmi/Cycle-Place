# D4 - Report Finale: Cycle Place

| Doc. Name | Doc. Number | Description |
| :--- | :--- | :--- |
| D4-Cycle PlaceFinale | D4 V1.0 | Report Finale del progetto: organizzazione del lavoro, ruoli, documentazione, video, tempo complessivo e di ciascun membro dedicato al progetto, criticità, autovalutazione. |

## 1. Organizzazione del lavoro
Per lo sviluppo dell'applicazione "Cycle Place", il Gruppo G01 ha adottato una metodologia di sviluppo ispirata ai principi **Agile**, mirata a favorire un approccio incrementale e iterativo. Al fine di mantenere l'allineamento sui task e sul progresso delle attività, è stato impiegato un sistema di gestione visuale **Kanban**, che ha permesso di mappare in modo trasparente gli stati di avanzamento (To Do, In Progress, Done). Il versionamento del codice e la gestione della *codebase* sono stati centralizzati su **GitHub**, sfruttando le dinamiche di branching e pull request per garantire integrità e revisione paritaria. 
Il team si è riunito con cadenza regolare, alternando incontri in presenza a *sync-call* telematiche, per fare il punto della situazione, risolvere blocchi operativi e rispettare le scadenze accademiche prefissate per i deliverable. In questo contesto, il Team Leader ha svolto un ruolo cruciale, coordinando le attività, facilitando le comunicazioni interne e assicurando che lo sforzo del gruppo procedesse coeso verso gli obiettivi concordati.

## 2. Ruoli e attività

| Componente del team | Ruolo | Principali attività |
| :--- | :--- | :--- |
| **Edvin Helmi** | Team Leader | Gestione progetto, coordinamento attività, stesura e revisione documenti (D1, D4), organizzazione dell'architettura generale. |
| **Lorenzo Pasotti** | Progettista | Realizzazione backend/logica, pipeline di CI/CD, scrittura test con Jest (D2). |
| **Natalina Perazzolli** | Analista | Fase di Design Thinking, UI/UX design, sviluppo frontend (mappa Leaflet, filtri, popup) e gestione requisiti nel D1. |

## 3. Carico e distribuzione del lavoro
Il carico di lavoro è stato equamente distribuito tra i componenti del team, bilanciando l'impegno in base alle rispettive competenze e responsabilità.

| Membro | D1 | D2 | D3 | D4 / Video | TOT |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Edvin Helmi** | 12 | 10 | 0 | 18 | **40** |
| **Lorenzo Pasotti** | 8 | 22 | 0 | 10 | **40** |
| **Natalina Perazzolli** | 18 | 12 | 0 | 10 | **40** |

Come si evince dalla tabella, è stato riportato il valore `0` nella colonna relativa al **D3** per tutti i membri del gruppo. Questo perché il deliverable D3 è stato concepito come elemento opzionale ai fini dell'ottenimento di punti extra, ed il team ha strategicamente scelto di non realizzarlo per potersi focalizzare sulla qualità dei deliverable fondamentali.

## 4. Criticità
Durante il ciclo di vita del progetto, il team ha dovuto affrontare e superare diverse criticità di natura organizzativa e tecnica:
* **Organizzazione Iniziale:** Nelle fasi embrionali (durante il D1), la sovrapposizione delle competenze portava i membri a svolgere attività frammentate ("tutti facevano tutto"), generando inefficienze. Il problema è stato risolto attraverso un'assegnazione netta e precisa dei ruoli formali.
* **Coordinate e Leaflet:** Difficoltà iniziale nell'integrazione dei dataset **GeoJSON**, le cui coordinate seguono nativamente lo standard `[Longitudine, Latitudine]`, scontrandosi con la libreria **Leaflet.js** che impone il formato `[Latitudine, Longitudine]`.
* **Standardizzazione dei Dati Spaziali:** Si è riscontrato che i dataset grezzi dei "Parcheggi protetti" erano sprovvisti di un identificativo univoco (`id`) e di categorizzazione, bloccando l'interazione con le API dei Preferiti e delle Segnalazioni. La criticità è stata superata implementando una *dynamic injection* nel backend, capace di generare e assegnare "al volo" le properties mancanti durante la decodifica.
* **Migrazione UI e Conflitti di Stato (DaisyUI):** Nelle fasi finali di *polish*, la migrazione architetturale verso **Tailwind CSS e DaisyUI** (per l'adozione dello stile *Glassmorphism*) ha generato insidiosi bug di rendering, in particolare la sovrascrittura delle dimensioni forzate (`min-height`) nei componenti *Join* e la corretta visualizzazione delle finestre modali. In quest'ultimo caso, è stato necessario riscrivere i controller JavaScript per interfacciarsi con le classi di stato intrinseche di DaisyUI (`.modal-open`), evitando che i box rimanessero nel DOM con opacità azzerata.

## 5. Autovalutazione
L'autovalutazione complessiva del lavoro svolto è estremamente positiva. Il gruppo ha dimostrato un impegno costante, reattività nella risoluzione dei problemi e una forte coesione, elementi che hanno garantito la consegna di un prodotto software stabile e aderente ai requisiti. 
A livello individuale, **Edvin** ha saputo guidare brillantemente il team con pragmaticità, assicurando che le scadenze venissero rispettate e garantendo una fluida integrazione del lavoro tra i reparti. **Lorenzo** ha assunto un'importanza vitale nel consolidamento strutturale del software, occupandosi eccellentemente della risoluzione dei complessi bug logici e curando la robustezza del codice tramite la test suite. **Natalina** ha infine eccelso sotto l'aspetto visivo e interattivo, tramutando concetti astratti in un'interfaccia utente chiara, accessibile e altamente intuitiva.
