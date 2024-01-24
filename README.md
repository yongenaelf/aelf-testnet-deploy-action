# AElf Testnet Deploy javascript action

This action deploys a given compiled aelf contract to the aelf testnet.

## Inputs

### `private-key`

**Required** Private key generated with aelf-command.

### `wallet-address`

**Required** AElf Address of the wallet associated with the private key.

### `dll-filename`

**Required** Path to the dll.patched file. Default `"src/bin/Debug/net6.0/HelloWorld.dll.patched"`.

### `node-url`

**Required** AElf Blockchain node url. Default `"https://tdvw-test-node.aelf.io"`.

## Outputs

### `block-hash`

Block Hash used to check for deployed contract address.

## Example usage

1. Using [aelf-command](https://docs.aelf.io/en/latest/reference/cli/methods.html), generate a new wallet.
2. Using [Portkey](https://portkey.finance/), get some testnet tokens at https://testnet-faucet.aelf.io/, transfer to the sidechain of the wallet in (1).

```yaml
uses: yongenaelf/aelf-testnet-deploy-action@v1.0
with:
  private-key: ${{ secrets.PrivateKey }}
  wallet-address: ${{ secrets.WalletAddress }}
```
