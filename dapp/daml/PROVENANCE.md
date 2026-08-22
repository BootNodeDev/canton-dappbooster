# Provenance

The `vesting-lite` DAML package, its test package, and the prebuilt DAR were vendored
verbatim from the vesting-lite branch of the `cn-dappbooster` monorepo.

| Field | Value |
|-------|-------|
| Source repo | https://github.com/BootNodeDev/cn-dappbooster |
| Source branch | `feat/vesting-lite` (deleted upstream; the commit is still reachable via the API) |
| Source commit | `e7e59b2c3e9b7de019418c12a33d43cd21bc85d4` |
| Imported | `dapp/daml/vesting-lite/`, `dapp/daml/multi-package.yaml`, `dapp/daml-test/`, `canton-barebones/dars/vesting-lite-0.0.1.dar` |

## Integration deltas

- `pnpm-workspace.yaml`, `knip.json` and the CI build filter follow the package down to
  `dapp/daml/vesting-lite`; `dapp/daml` itself is no longer a workspace member.
- Nothing else. The DAML sources, `daml.yaml` files and `package.json` are unmodified.

## Verified on import

`bash scripts/build-dar.sh dapp/daml/vesting-lite` under `dpm` 1.0.10 reproduces the
checked-in DAR's main package id, `cb2c14a74262545f4dbc8fb7c98a1808bc2ad2cf12c5d348d875a842e1ab4cf1`.
`dpm test` in `dapp/daml-test` passes its nine scenarios.
