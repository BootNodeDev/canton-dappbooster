# dApp Frontend (starter)

A small demo app.

The main feature is a Stampbook: a digital loyalty stamp card living on the
Canton ledger. A **merchant** issues the card and delegates stamping to their
**staff**, who hand out stamps to customers. The **cardholder** collects those
stamps and watches them add up toward a reward. Every stamp is a real Canton
transaction, so the card is shared, tamper-proof state rather than a number in
some private database.

## Connecting

- Click `Connect with Carpincho`.
- Approve the request in Carpincho.

## WalletConnect fallback

A `Connect with WalletConnect` button is available, but
it requires a Reown project id;

Get a project id from [cloud.reown.com](https://cloud.reown.com), then set
`VITE_WC_PROJECT_ID` in `.env.local`:

```bash
# dapp/frontend/.env.local
VITE_WC_PROJECT_ID=your_reown_project_id
```