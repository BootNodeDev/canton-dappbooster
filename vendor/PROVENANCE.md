# vendor/

The two Daml packages this repository needs, committed as binaries. Neither is
built here: `dpm` is not a requirement to run this repository, and both DARs are
byte-reproducible from a clean tree at the tag below, so they can be rebuilt and
compared rather than trusted.

## `canton-token-forge.dar`

| | |
|---|---|
| Source | https://github.com/BootNodeDev/canton-token-forge |
| Release | `v0.3.0` |
| Asset | `canton-token-forge-0.0.1.dar` |
| Size | 725807 bytes |
| sha256 | `147835e775e523f78c784996c43500c57e1ed97bcab97c97df6515b65f9332da` |
| package-id | `20d54824dc4d76694c70ac51dd5f0b9e063ab789ffa02d07432abb848c8360cc` |
| Built against Splice | `0.6.7` (commit `c8d8d977794c514ed2ee9eb64de322a6779898f3`) |
| Daml SDK | 3.4.11 |
| LF target | 2.1 |

The asset is byte-identical to the ones on `v0.1.0` and `v0.2.0`. It is taken
from `v0.3.0` because that is also the tag `package.json` pins the registry
service to, so one tag governs both halves of the dependency.

It bundles all six `splice-api-token-*` interface packages it links against, at
the package-ids it was compiled with, so this repository vendors no Splice of
its own.

## `vesting.dar`

| | |
|---|---|
| Source | https://github.com/BootNodeDev/canton-vesting-forge |
| Release | `v0.2.0` |
| Asset | `vesting-0.0.2.dar` |
| Size | 688686 bytes |
| sha256 | `b78439bafdfb4c2e38666d3d99ac73e8c27722dada41d52876d997f16858d5b3` |
| package-id | `e96e3b9b70a12538cc3bba264480dca9e88e87593706cc3f2e638e877ff99f67` |
| Bundled canton-token-forge | 0.0.1, package-id `20d54824dc4d76694c70ac51dd5f0b9e063ab789ffa02d07432abb848c8360cc` |
| Daml SDK | 3.4.11 |
| LF target | 2.1 |

`vesting` data-depends on `canton-token-forge`, so the participant must have
`canton-token-forge.dar` before this one: `scripts/dev-stack.sh` uploads them in
that order.

## Re-verifying

    sha256sum vendor/canton-token-forge.dar vendor/vesting.dar

## Updating

There is no automated update path. To move to a later release of either: replace
the binary, re-run the checksum, and update every row above by hand.

A participant that already vetted an earlier version of the same package refuses
the new one outright when the two are not a valid smart-contract upgrade:
`vesting` 0.0.2 changed `VestingFactory_CreateVesting`'s return type, so a
LocalNet carrying 0.0.1 answers the upload with
`NOT_VALID_UPGRADE_PACKAGE`. Nothing can be uploaded past that; drop the ledger
first and let the stack redeploy both DARs onto it:

    ./scripts/dev-stack.sh down
    ( cd .canton-localnet && ../node_modules/.bin/canton-barebones reset )
    ./scripts/dev-stack.sh up
