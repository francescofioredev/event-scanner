# PRD — Event Finder MCP

**Sprint:** sabato 28 marzo 2026 — deadline ore 18:00
**Team:** 4 persone (Claude Pro + Claude Code)
**Deliverable:** MCP server funzionante, testato, con README per l'installazione

---

## 1. Contesto e visione

### Il problema
Trovare eventi rilevanti in una città richiede oggi di consultare manualmente più piattaforme (Eventbrite, Meetup, Google, Instagram), con risultati frammentati, non filtrabili e spesso scoperti in ritardo. Non esiste un modo per chiedere in linguaggio naturale "cosa c'è di interessante per me questo weekend?" e ottenere una risposta aggregata e azionabile.

### La soluzione
Un MCP server che trasforma Claude in un assistente per la scoperta di eventi. L'utente parla naturalmente, il server cerca su più piattaforme in parallelo, normalizza i risultati e restituisce schede evento strutturate e confrontabili.

### Perché un MCP
L'evento discovery è un task conversazionale, non un'attività di browsing. L'utente ha già Claude aperto. Non serve un'app nuova — serve una capability nuova dentro uno strumento che già usa.

### JTBD di riferimento (MVP)

**Job 1 — Trovare eventi per i miei interessi, adesso**
> Quando ho tempo libero e voglio fare qualcosa di rilevante, ho bisogno di cercare su più piattaforme contemporaneamente, filtrare per interessi/città/data, e ottenere risultati puliti — non rumore.

**Job 2 — Decidere se un evento merita il mio tempo**
> Quando trovo qualcosa di interessante, ho bisogno di dettagli sufficienti (descrizione, agenda, venue, prezzo) per decidere in 30 secondi senza aprire cinque browser tab.

---

## 2. Scope MVP — cosa consegniamo alle 18

### Tool 1: `search_events`

**Scopo:** Ricerca multi-piattaforma di eventi per keyword, città e periodo.

| Campo | Tipo | Obbligatorio | Note |
|-------|------|:---:|-------|
| `query` | string | sì | Keyword o tema (es. "tech meetup", "jazz") |
| `city` | string | sì | Città (es. "Turin", "Milano") |
| `date_from` | string | no | Data inizio (ISO format). Default: oggi |
| `date_to` | string | no | Data fine. Default: +7 giorni |
| `category` | enum | no | tech, music, food, art, sports, networking, other |

**Fonti dati:**
- **SerpAPI Google Events** (fonte primaria) — aggrega automaticamente Eventbrite, Meetup, Facebook, siti locali
- **Meetup GraphQL API** (fonte secondaria) — profondità su eventi community e professionali

**Output:** Lista di event card normalizzate (vedi schema sotto).

**Comportamento atteso:**
- Chiama entrambe le fonti in parallelo
- Deduplica risultati con matching su titolo + data + venue (fuzzy)
- Ordina per data (più vicini prima)
- Max 20 risultati per chiamata

### Tool 2: `get_event_details`

**Scopo:** Recuperare informazioni dettagliate su un singolo evento.

| Campo | Tipo | Obbligatorio | Note |
|-------|------|:---:|-------|
| `event_id` | string | sì | ID restituito da search_events |
| `source` | enum | sì | "google_events" o "meetup" |

**Output:** Event card estesa con descrizione completa, info organizzatore, link diretto.

### Tool 3: `filter_by_category`

**Scopo:** Ricerca rapida pre-filtrata per categoria specifica.

| Campo | Tipo | Obbligatorio | Note |
|-------|------|:---:|-------|
| `city` | string | sì | Città |
| `category` | enum | sì | tech, music, food, art, sports, networking |
| `date_from` | string | no | Default: oggi |
| `date_to` | string | no | Default: +7 giorni |

**Comportamento:** Wrapper su `search_events` con query pre-costruita per categoria. Semplifica l'uso conversazionale ("cosa c'è di tech a Torino?").

---

## 3. Schema dati

### Event Card (base) — output di search_events

```json
{
  "id": "evt_google_abc123",
  "source": "google_events",
  "title": "AI & Machine Learning Meetup Torino",
  "date": {
    "start": "2026-03-30T18:30:00+02:00",
    "end": "2026-03-30T21:00:00+02:00",
    "display": "Lun 30 Mar, 18:30 – 21:00"
  },
  "venue": {
    "name": "Toolbox Coworking",
    "address": "Via Agostino da Montefeltro 2, Torino"
  },
  "category": "tech",
  "price": {
    "is_free": true,
    "display": "Gratuito"
  },
  "link": "https://www.meetup.com/...",
  "description_short": "Primo paragrafo o prime 200 chars...",
  "thumbnail": "https://..."
}
```

### Event Card (estesa) — output di get_event_details

Aggiunge a Event Card base:

```json
{
  "description_full": "Descrizione completa HTML/text...",
  "organizer": {
    "name": "Torino AI Community",
    "link": "https://..."
  },
  "ticket_info": [
    { "source": "Eventbrite", "link": "https://...", "price": "Gratuito" }
  ],
  "attendees": {
    "count": 45,
    "display": "45 partecipanti"
  }
}
```

---

## 4. Architettura tecnica

### Stack
- **Linguaggio:** Python 3.11+
- **Framework MCP:** FastMCP
- **HTTP client:** httpx (async, per chiamate parallele)
- **Dipendenze esterne:** serpapi (python client), requests

### Struttura progetto

```
event-finder-mcp/
├── src/
│   ├── server.py              # Entry point MCP + tool definitions
│   ├── sources/
│   │   ├── google_events.py   # SerpAPI Google Events wrapper
│   │   └── meetup.py          # Meetup GraphQL wrapper
│   ├── models.py              # Pydantic models (EventCard, EventDetail)
│   ├── merger.py              # Deduplicazione + normalizzazione
│   └── config.py              # Env vars, costanti
├── tests/
│   ├── test_google_events.py
│   ├── test_meetup.py
│   └── test_merger.py
├── .env.example
├── requirements.txt
├── README.md
└── pyproject.toml
```

### API keys necessarie

| Servizio | Come ottenere | Free tier |
|----------|--------------|-----------|
| SerpAPI | serpapi.com → Sign up → Dashboard | 100 ricerche/mese |
| Meetup | meetup.com → API settings → OAuth token | Rate limited, no hard cap |

### Configurazione ambiente

```bash
SERPAPI_KEY=your_key_here
MEETUP_OAUTH_TOKEN=your_token_here
```

---

## 5. Criteri di accettazione

### Must-have (senza questi non consegnamo)

- [ ] `search_events("tech meetup", "Turin")` restituisce almeno 5 risultati da Google Events
- [ ] `search_events("music", "Milano")` restituisce risultati da almeno una fonte
- [ ] Ogni event card ha: title, date, venue, link (nessun campo nullo tra questi)
- [ ] `get_event_details` restituisce descrizione completa per un evento
- [ ] `filter_by_category("Turin", "tech")` restituisce risultati coerenti con la categoria
- [ ] Il server si avvia e si connette a Claude Desktop senza errori
- [ ] README con istruzioni di installazione funzionanti (copy-paste)

### Should-have (se il tempo lo permette)

- [ ] Meetup come seconda fonte attiva (non mockato)
- [ ] Deduplicazione cross-source funzionante
- [ ] Gestione errori graceful (API down → messaggio chiaro, non crash)
- [ ] Date range filtering effettivo (non solo passato a SerpAPI)

### Won't-have (esplicitamente fuori scope)

- Notifiche / monitoring / digest
- Profilo utente persistente
- Google Calendar integration
- Registration / autofill
- UI / frontend
- Deploy su cloud (basta funzionare in locale)

---

## 6. Allocazione team e timeline

### Team

| Ruolo | Persona | Responsabilità |
|-------|---------|----------------|
| **P1 — Lead backend** | — | server.py, config, models, integrazione finale |
| **P2 — Source: Google Events** | — | google_events.py, parsing SerpAPI, test |
| **P3 — Source: Meetup** | — | meetup.py, GraphQL queries, test |
| **P4 — Merger + DX** | — | merger.py, README, test e2e, demo prep |

### Timeline (adattare in base all'ora di inizio)

**Fase 1 — Setup parallelo (60 min)**

| Chi | Cosa | Output |
|-----|------|--------|
| P1 | Scaffold progetto, FastMCP server con tool stubs, modelli Pydantic | server.py funzionante con tool vuoti |
| P2 | Account SerpAPI, test manuale in playground, implementa `google_events.py` | Funzione che restituisce eventi raw da SerpAPI |
| P3 | Token Meetup OAuth, test GraphQL query, implementa `meetup.py` | Funzione che restituisce eventi raw da Meetup |
| P4 | Scrive .env.example, requirements.txt, struttura test, inizia merger.py | Skeleton test + logica dedup base |

**Checkpoint 1:** ogni source restituisce dati raw. Server si avvia.

**Fase 2 — Integrazione (60 min)**

| Chi | Cosa | Output |
|-----|------|--------|
| P1 | Collega sources ai tool, implementa chiamate parallele (asyncio.gather) | search_events funzionante end-to-end |
| P2 | Normalizzazione output Google Events → EventCard schema | JSON pulito e conforme allo schema |
| P3 | Normalizzazione output Meetup → EventCard schema | JSON pulito e conforme allo schema |
| P4 | Completa merger (dedup fuzzy su titolo+data), implementa filter_by_category | Risultati merged e deduplicati |

**Checkpoint 2:** `search_events` restituisce card normalizzate da entrambe le fonti.

**Fase 3 — Polish + test + delivery (60 min)**

| Chi | Cosa | Output |
|-----|------|--------|
| P1 | get_event_details, error handling su tutte le sources | Tool completo con gestione errori |
| P2 | Test manuali su 5+ città, fix edge cases (eventi senza venue, senza data) | Report test con risultati |
| P3 | Test manuali Meetup, fallback se API non risponde | Source resiliente |
| P4 | README completo, test in Claude Desktop, prepara demo | Progetto consegnabile |

**Checkpoint 3 / Delivery:** progetto funzionante, testato, documentato.

---

## 7. Rischi e mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|:-----------:|:-------:|-------------|
| SerpAPI free tier esaurito durante test | Media | Alto | Usare caching locale dei risultati durante sviluppo. Testare con query diverse. |
| Meetup OAuth token complesso da ottenere | Media | Medio | Se blocca > 30 min, mockare Meetup e procedere con sola Google Events. Il valore core è la multi-source search, non il numero di fonti. |
| Deduplicazione imprecisa | Alta | Basso | V1 usa matching semplice (titolo lowercase + stessa data). Raffinamento in V1.1. |
| SerpAPI restituisce pochi risultati per città piccole | Media | Medio | Ampliare raggio di ricerca automaticamente. Fallback: mostrare risultati disponibili con nota. |

---

## 8. Istruzioni per Claude Code

Ogni membro del team usa Claude Code. Per allineare l'output:

**System prompt suggerito per il progetto:**

```
Stai lavorando su un MCP server Python (FastMCP) per la ricerca eventi.
Stack: Python 3.11+, FastMCP, httpx (async), Pydantic.
Convenzioni: type hints ovunque, docstring su funzioni pubbliche, 
nomi variabili in inglese, commenti in inglese.
Output format: JSON con schema definito in models.py.
Error handling: mai crash — restituisci messaggio utente-friendly.
```

**Regola d'oro:** se qualcosa blocca per più di 20 minuti, chiedi aiuto al team o semplifica. Il nemico è il tempo, non la perfezione.

---

## 9. Definition of Done

Il progetto è consegnato quando:

1. Il server MCP si installa con `pip install -r requirements.txt`
2. Si configura con due env vars (SERPAPI_KEY + MEETUP_OAUTH_TOKEN)
3. Si avvia con un comando (`python -m src.server` o equivalente)
4. Si connette a Claude Desktop tramite configurazione MCP standard
5. L'utente può chiedere "trova eventi tech a Torino questo weekend" e ricevere risultati strutturati
6. Il README documenta tutti i passaggi sopra in modo copy-paste
7. Almeno i criteri must-have sono tutti verificati
