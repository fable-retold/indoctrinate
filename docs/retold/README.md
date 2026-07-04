# Retold Documentation Hub

Indoctrinate powers the unified Retold documentation hub, which aggregates documentation from 50+ modules across multiple GitHub repositories into a single Docsify site. Content is fetched live from each module's GitHub repo at browse-time, while navigation and search are driven by Indoctrinate-generated catalog and keyword index files.

## Architecture

<!-- bespoke diagram: edit diagrams/architecture.mmd or .hints.json, then: npx pict-renderer-graph build modules/utility/indoctrinate/docs/retold -->
![Architecture](diagrams/architecture.svg)

## How It Works

### Catalog (Structure)

The `generate_catalog` command scans all modules locally and produces `retold-catalog.json`. This file maps every module's documentation structure: which modules have docs, their sidebar navigation, and their GitHub repo names.

The Docsify hub loads this catalog and builds route aliases so that a URL like `/#/fable/fable-log/getting-started.md` fetches content from `https://raw.githubusercontent.com/fable-retold/fable-log/master/docs/getting-started.md`.

### Keyword Index (Search)

The `generate_keyword_index` command reads all markdown content from module docs and builds a lunr search index. The Docsify hub loads this index client-side to provide cross-module search.

### Content (Live)

Content is never copied or stored in the hub. It is fetched at browse-time from each module's GitHub repository. This means content updates are reflected immediately without regenerating anything.

## What Changes When

| Event | Action Needed |
|-------|--------------|
| Someone edits a markdown file in a module | Nothing. Content is fetched live. |
| A new module is added to Retold | Re-run `generate_catalog`. |
| A module's sidebar navigation changes | Re-run `generate_catalog`. |
| You want updated search results | Re-run `generate_keyword_index`. |

## Workflow

```bash
# From the indoctrinate module directory:

# 1. Generate the catalog
npx indoctrinate generate_catalog \
    -d /path/to/retold/modules \
    -o /path/to/retold/docs/retold-catalog.json

# 2. Generate the keyword index
npx indoctrinate generate_keyword_index \
    -d /path/to/retold/modules \
    -o /path/to/retold/docs/retold-keyword-index.json

# 3. Commit the updated files to the retold repo
# 4. GitHub Pages serves the docs site automatically
```

## Hub File Layout

<!-- bespoke diagram: edit diagrams/hub-file-layout.mmd or .hints.json, then: npx pict-renderer-graph build modules/utility/indoctrinate/docs/retold -->
![Hub File Layout](diagrams/hub-file-layout.svg)

## Module Groups

The catalog organizes modules into five groups:

| Group | Description | Count |
|-------|-------------|-------|
| Fable | Core framework: DI, config, logging, UUID | ~7 |
| Meadow | Data access: ORM, query DSL, schema, DB connectors | ~16 |
| Orator | API server: Restify, static files, proxy, WebSocket | ~7 |
| Pict | MVC: views, templates, providers, forms, TUI | ~18 |
| Utility | Build tools, manifests, documentation, supervision | ~12 |

## Further Reading

- [Catalog Generation](catalog-generation.md) - Details on catalog structure and sidebar parsing
- [Keyword Index](keyword-index.md) - Details on search index building and lunr integration
