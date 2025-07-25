This guide is meant for people wishing to contribute to this open-source project. For more information on contributing, see [CONTRIBUTING](CONTRIBUTING.md).

## Prerequisites

### Node.js v20

Since this is a JavaScript action, you will need Node.js v20.x. If you do not have it installed, you can install it in [a variety of ways](https://nodejs.org/en/download).

## Development

### Installing dependencies

Before you can work on the project, you need to install dependencies. Run:

```shell
npm install
```

### `npm` scripts

The project includes all required commands via `npm` scripts.

| `npm` command     | Effect                                             |
|-------------------|----------------------------------------------------|
| `npm test`        | Run the tests                                      |
| `npm run lint`    | Run `oxlint` on the code                           |
| `npm run format`  | Run `prettier` to format the code                  |
| `npm run build`   | Build the package                                  |
| `npm run refresh` | Rebuild the package, cleaning up `dist` beforehand |
| `npm run all`     | Rebuild package, run `oxlint` and run the tests    |

## Questions?

If any part of this documentation is unclear, please open a [new issue](https://github.com/clechasseur/rs-actions-core/issues/new/choose) so it can be fixed.
