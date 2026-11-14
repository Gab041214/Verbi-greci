# Verbi-greci — coniugatore dei verbi greci moderni (PWA)

Scrivi un verbo alla 1ª persona singolare del presente indicativo e vedi tutte le coniugazioni (voce attiva e passiva, indicativo, congiuntivo, imperativo, forme nominali, tempi composti). Funziona offline e si può installare come app.

Nessuna dipendenza: solo Node ≥ 18 per build e test.

## Comandi

```bash
npm run dev     # server locale su http://localhost:8080 (serve src/)
npm test        # test del motore e dell'importatore
npm run build   # genera dist/ (copia di src/ + service worker con elenco file e versione)
```

## Pubblicazione: GitHub + Cloudflare Pages

1. Crea un repository su GitHub e carica il contenuto di questa cartella.
2. Cloudflare → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → scegli il repository.
3. Impostazioni di build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Variabile d'ambiente (opzionale): `NODE_VERSION` = `20`
4. Ogni push su `main` ripubblica il sito. Il service worker cambia versione a ogni build, quindi gli utenti ricevono l'aggiornamento.

## Struttura

- `src/js/engine.js` – regole di coniugazione (classi A, B1, B2, D, DA, DB1, DB2, X)
- `src/js/lexicon.js` – lessico di base curato (irregolari e verbi frequenti)
- `src/js/wiktionary.js` – importatore da Wiktionary (API MediaWiki, eseguito nel browser)
- `src/js/store.js` – archivio personale in IndexedDB
- `src/data/extra.json` – verbi extra versionati nel repository
- `src/sw.js`, `src/manifest.webmanifest`, `src/_headers` – parte PWA e header Cloudflare

## Dati: come si aggiungono e si correggono i verbi

- **Cerca**: un verbo non presente è coniugato con le regole e segnalato come «da verificare»; si può salvare.
- **Aggiungi → Importa da Wiktionary**: scarica la tabella del verbo, mostra un'anteprima, poi salva. C'è anche l'importazione di massa dalla *Category:Greek verbs* e l'incolla manuale della tabella.
- **Aggiungi → Inserimento manuale**: lemma, classe, temi dell'aoristo, oppure una riga nel formato del lessico.
- **Correggi forme** (nella scheda del verbo): modifica qualsiasi forma; le celle toccate diventano forme esatte, le altre continuano a seguire le regole.

I dati inseriti restano nel browser (IndexedDB) del dispositivo. Per renderli permanenti per tutti:
**Archivio → Esporta JSON**, sostituisci `src/data/extra.json` con il file scaricato, fai commit e push. Lo stesso file si può reimportare su un altro dispositivo con *Importa JSON*.
Precedenza: dati personali > `extra.json` > lessico di base.

## Note

- L'importatore interroga `en.wiktionary.org` direttamente dal browser (l'API consente CORS con `origin=*`) e legge la tabella nella sezione Greek. Se la struttura della pagina cambia, usa «Incolla la tabella» o l'inserimento manuale, e correggi dall'editor.
- Le forme del lessico di base sono state scritte a mano e vanno verificate su un dizionario.

