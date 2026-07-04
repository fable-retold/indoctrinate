# Catalog Generation

The Retold catalog maps every module's documentation structure into a single JSON file that the Docsify hub uses for navigation and route aliasing.

## Service

```javascript
fable.IndoctrinateRetoldCatalog
```

## Module Discovery

Indoctrinate discovers modules by analyzing the `__LABELSET_ADDRESS` labels of cataloged content. In a directory structure like:

<!-- bespoke diagram: edit diagrams/module-discovery.mmd or .hints.json, then: npx pict-renderer-graph build modules/utility/indoctrinate/docs/retold -->
![Module Discovery](diagrams/module-discovery.svg)

A file's address labels would be `["fable", "fable-log", "docs"]`. The first label is the group name, the second is the module name.

### Detection Rules

- **Module exists** - Any two-level directory path under the scan root creates a module entry
- **Has documentation** - The module has at least one file with `docs` in its address labels
- **Has sidebar** - A `_sidebar.md` file exists in the docs folder with loaded content
- **Has cover** - A `cover.md` file exists in the docs folder

Modules without documentation still appear in the catalog with `HasDocs: false`.

## Sidebar Parsing

The sidebar parser converts Docsify `_sidebar.md` format into a structured tree.

### Input Format

```markdown
- Getting Started

  - [Introduction](/)
  - [Quick Start](getting-started.md)

- API Reference

  - [Authentication](api/auth.md)
  - [Endpoints](api/endpoints.md)
```

### Output Structure

```json
[
    {
        "Title": "Getting Started",
        "Children": [
            { "Title": "Introduction", "Path": "README.md" },
            { "Title": "Quick Start", "Path": "getting-started.md" }
        ]
    },
    {
        "Title": "API Reference",
        "Children": [
            { "Title": "Authentication", "Path": "api/auth.md" },
            { "Title": "Endpoints", "Path": "api/endpoints.md" }
        ]
    }
]
```

### Path Normalization

| Sidebar Path | Normalized Path |
|-------------|-----------------|
| `/` | `README.md` |
| `/getting-started.md` | `getting-started.md` |
| `api/` | `api/README.md` |
| `api/auth.md` | `api/auth.md` |

## Group Ordering

Groups are output in canonical order: Fable, Meadow, Orator, Pict, Utility. Any additional groups discovered beyond these five are appended at the end. Modules within each group are sorted alphabetically.

## Programmatic Access

```javascript
const libPict = require('pict-service-commandlineutility');
const libIndoctrinate = require('indoctrinate/source/Indoctrinate-Fable-Service');

let tmpPict = new libPict();
tmpPict.addServiceType('Indoctrinate', libIndoctrinate);

let tmpCompiler = tmpPict.instantiateServiceProvider('Indoctrinate', {
    directory_root: '/path/to/retold/modules',
    output_file: '/path/to/retold/docs/retold-catalog.json',
    github_org: 'stevenvelozo',
    branch: 'master'
});

tmpCompiler.generateCatalog(function (pError)
{
    if (pError) { console.error(pError); return; }

    // Access the catalog
    let tmpCatalog = tmpCompiler.retoldCatalog;
    console.log(tmpCatalog.Groups.length + ' groups');
});
```

## Route Alias Pattern

The Docsify hub plugin transforms catalog entries into route aliases:

```javascript
// For module: { Group: "fable", Name: "fable-log", Repo: "fable-log", Branch: "master" }
// Generates alias:
'/fable/fable-log/(.*)' -> 'https://raw.githubusercontent.com/fable-retold/fable-log/master/docs/$1'
```

This means the URL `/#/fable/fable-log/getting-started.md` smoothly fetches from GitHub.
