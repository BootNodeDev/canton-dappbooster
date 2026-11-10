# Provenance

This `amulet-vesting` Daml package is a copy of the one in
[`example-dapps/amulet-vesting/daml/`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/amulet-vesting/daml),
so a project made from this example carries its own contract.

| Field | Value |
|-------|-------|
| Source | `example-dapps/amulet-vesting/daml/` in this repository |
| Source commit | `b8a7ce7a161593d439717506a54b7824def32e81` |
| Copied | `daml.yaml`, `AmuletVesting.daml`, `AmuletVesting/Schedule.daml`, `.gitignore`, `README.md` |

The Daml source and `daml.yaml` are unchanged: the same package name, version and SDK, so both
examples build the same DAR. Where that source came from, and what changed on the way, is in
[that folder's `PROVENANCE.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/amulet-vesting/daml/PROVENANCE.md).

The one edit is in `README.md`, whose provenance link points at this file.

The wallet-less repository this example came from carried the same source at version `0.0.2` on
SDK `3.4.11`. This copy takes the monorepo's `0.0.3` on `3.5.2` instead.
