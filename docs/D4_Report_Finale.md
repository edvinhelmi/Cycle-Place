# D4 - Report Finale: Cycle Place

| Doc. Name | Doc. Number | Description |
| :--- | :--- | :--- |
| D4-Cycle PlaceFinale | D4 V1.1 | Report Finale del progetto: organizzazione del lavoro, ruoli, documentazione, video, tempo complessivo e di ciascun membro dedicato al progetto, criticità, autovalutazione. |

## 1. Organizzazione del lavoro
Per lo sviluppo dell'applicazione "Cycle Place", il Gruppo G52 ha adottato una metodologia di sviluppo ispirata ai principi **Agile**, mirata a favorire un approccio incrementale e iterativo. Al fine di mantenere l'allineamento sui task e sul progresso delle attività, è stato impiegato un sistema di gestione visuale **Kanban**, che ha permesso di mappare in modo trasparente gli stati di avanzamento e assegnare l'adeguata priorità ad ogni compito.
Per organizzare meglio la gestione è stato adottato un approccio a *"Derivable Managers"* , questo significa che ogni membro del gruppo aveva un ruolo *organizzativo* per un singolo derivable in modo da poter riportare al Team Leader uno stato di avanzamento preciso.
Il versionamento del codice e la gestione della *codebase* sono stati centralizzati su **GitHub**, sfruttando le dinamiche di branching e pull request per garantire integrità e revisione paritaria. 
Il team si è principalmente incontrato in presenza, ma ha lasciato spazio allo sviluppo individuale e ha svolto meeting settimanali online per gestire meglio le scadenze e riportare eventuali problemi riscontrati durante il lavoro.
Questo approccio è risultato vincente in particolare durante i blocchi riscontrati durante il lavoro individuale, quando un problema bloccava troppo a lungo un membro, la risoluzione di esso diventava prioritaria per ogni membro, in modo da progredire in modo più bilanciato con il lavoro.
La divisione è avvenuta principalmente per competenze, in modo da verticalizzare la conoscenza di un argomento di interesse per ogni membro.


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
* **Organizzazione Iniziale:** Nelle prime fasi il gruppo ha subito svariati rallentamenti a causa di una scarsa organizzazione, da quando il gruppo ha iniziato ad utilizzare più intensamente le metodologie AGILE e ha integrato i "Derivable Managers" il problema si è risolto.
* **Standardizzazione dei Dati Spaziali:** Si è riscontrato che i dataset grezzi dei "Parcheggi protetti" erano sprovvisti di un identificativo univoco (`id`) e di categorizzazione, bloccando l'interazione con le API dei Preferiti e delle Segnalazioni. La criticità è stata superata implementando una *dynamic injection* nel backend, capace di generare e assegnare "al volo" le properties mancanti durante la decodifica.
* **Migrazione UI e Conflitti di Stato (DaisyUI):** Nelle fasi finali di *polish*, la migrazione architetturale verso **Tailwind CSS e DaisyUI** (per l'adozione dello stile *Glassmorphism*) ha generato insidiosi bug di rendering, in particolare la sovrascrittura delle dimensioni forzate (`min-height`) nei componenti *Join* e la corretta visualizzazione delle finestre modali. In quest'ultimo caso, è stato necessario riscrivere i controller JavaScript per interfacciarsi con le classi di stato intrinseche di DaisyUI (`.modal-open`), evitando che i box rimanessero nel DOM con opacità azzerata.

## 5. Autovalutazione

L'autovalutazione è risultata estremamente positiva. Nonostante le poche competenze organizzative e le poche conoscenze delle tecnologie avute all'inizio del percorso ogni membro è riuscito ad ottenere delle solide basi di ogni strumento e sviluppare soft-skill utili nel lavoro in Team. Inoltre grazie alla gestione verticalizzata del lavoro ogni componente del gruppo ha avuto l'opportunità di approfondire ulteriormente determinate fasi dello sviluppo che più interessavano individualmente.
Questo è stato il punto di forza del gruppo, nonostante un inizio complesso sono stati subito individuati gli interessi individuali, developing puro per Edvin, organizzazione strutturale e grafica dell'applicazione per Natalina e gestione del lavoro e delle normative per Lorenzo.

Date le precedenti considerazioni e le parti facoltative svolte la nostra autovalutazione è la seguente:

| Edvin Helmi         | 30  |
| ------------------- | --- |
| Pasotti Lorenzo     | 30  |
| Natalina Perazzolli | 30  |
