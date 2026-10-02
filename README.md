# scarpet-docgen

Generate markdown documentation from [Scarpet](https://github.com/gnembon/fabric-carpet)
scripts. Scans a directory tree of `.sc`/`.scl` files, parses each one with a
fault-tolerant Scarpet parser, and emits a `docs/` folder that mirrors the
input structure: one `.md` file per script plus an `index.md` in every
directory.

## How it works

- Every **documented symbol** (a function or global that has a `///` doc
  comment) is rendered as a level-2 heading. Global constants
  (`global_SOME_CONST`), globals (`global_some_value`), public functions,
  protected functions (`_name`) and private functions (`__name`) are all
  supported.
- Symbols without a doc comment are skipped, so scripts with no
  documentation at all produce no file and are listed nowhere.
- The script-level header comment (a leading `///` block) becomes the
  description under the `# <file>.scl` title.
- `index.md` files list the directory's subdirectories and scripts. A script
  that shares its name with its folder (e.g. `utils/utils.scl`) is treated as
  the entrypoint and listed first; everything else is alphabetical.

## Usage

```bash
npx scarpet-docgen <input-dir> [--out <dir>]
```

| Argument    | Description                                        |
| ----------- | -------------------------------------------------- |
| `<input-dir>` | Directory containing Scarpet scripts (`.sc`/`.scl`). |
| `--out <dir>` | Output directory. Defaults to `<input-dir>/docs`.    |
| `--help`      | Show help.                                           |

### Example

```bash
scarpet-docgen /path/to/my/scripts
```

This writes the docs to `/path/to/my/scripts/docs`:

```text
docs/
├── index.md
└── utils/
    ├── index.md
    ├── utils.md
    └── globs.md
```

The CLI prints the output directory once, then each documented script with
its path relative to the input directory:

```text
Scarpet docs saved in /path/to/my/scripts/docs
  utils/utils.scl
  utils/globs.scl
```

### Example input → output

Given `utils/utils.scl`:

```scarpet
/// Utility helpers shared across my scripts.

/// The maximum length a name may have.
global_MAX_NAME_LEN = 64;

/// Join two strings together.
join(a, b) -> (
    a + b;
);
```

The generated `docs/utils/utils.md` is:

```markdown
# utils.scl

Utility helpers shared across my scripts.

## global_MAX_NAME_LEN

The maximum length a name may have.

## join(a, b)

Join two strings together.
```

## Installation

Requires Node.js >= 20.

```bash
git clone https://github.com/fewwan/scarpet-docgen.git
cd scarpet-docgen
pnpm install
```

Run it via the local binary:

```bash
node bin/scarpet-docgen <input-dir>
```

or link it globally:

```bash
npm link
scarpet-docgen <input-dir>
```

## Development

```bash
pnpm install
npm run lint    # type-check + lint
npm run format  # prettier
```

## License

MIT