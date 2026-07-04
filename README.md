# Indoctrinate

> **[Read the Indoctrinate Documentation](https://fable-retold.github.io/indoctrinate/)** - interactive docs with the full API reference.

A simple documentation scaffolding (sub)system.

## Vocabulary

1. Output Structure
1. Part
1. Address
1. Location
1. Name
1. Label

## Concepts

### Hash

Each piece of content has a unique hash.  Generated content has a prefix and a GUID designated.  Incoming content has an `address` (which includes both a `location` and a `name`).

### Labels

Each piece of content coming in or generated has a set of labels.  These are used as forward looking matches for inclusion or exclusion based on filters.


## JQ Recipes

Enumerate a catalog and generate full file names and inferred file types (where the inferred file type is not empty):

```
jq '.SourceContentCatalog[]' dist/indoctrinate_content_staging/Indoctrinate-Catalog-AppData.json | jq -c 'select(.ExtendedContent.MIMECHK | length > 0)'
```

Enumerate a catalog and generate a copy command to _TARGET_FOLDER ready for some search and replace simplicity
* the sed does replacing of the _DBL_QT variable for double quotes because otherwise writing it to work on mac and linux is almost impossible
* there is a "do this in less jq steps" version of this but this makes it easier to retool specific parts of the chain
* the -r in last jq query makes the output raw and so not wrapped in double quotes

```
jq '.SourceContentCatalog[]' dist/indoctrinate_content_staging/Indoctrinate-Catalog-AppData.json \
| jq -c 'select(.ExtendedContent.MB_EXT != null)' \
| jq '.Command = "cp _DBL_QT" + .Location + "/" + .Name + "_DBL_QT _DBL_QT_TARGET_FOLDER/" + .Name + "." + .ExtendedContent.MB_EXT + "_DBL_QT"' | jq -r .Command | sed 's/_DBL_QT/"/g' \
> Copy_Operation.sh
```

## Fast MD5

https://www.npmjs.com/package/hash-wasm

## Related Packages

- [fable](https://github.com/fable-retold/fable) - Application services framework

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/fable-retold/retold/blob/main/docs/contributing.md).
