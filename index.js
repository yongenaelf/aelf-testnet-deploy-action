const core = require("@actions/core");
const AElf = require("aelf-sdk");
const BigNumber = require("bignumber.js");
const fs = require("fs");

(async () => {
  try {
    const PRIVATE_KEY = core.getInput("private-key");
    const WALLET_ADDRESS = core.getInput("wallet-address");
    const DLL_FILENAME = core.getInput("dll-filename");
    const NODE_URL = core.getInput("node-url");

    const aelf = new AElf(new AElf.providers.HttpProvider(NODE_URL));

    const wallet = AElf.wallet.getWalletByPrivateKey(PRIVATE_KEY);

    const tokenContractName = "AElf.ContractNames.Token";
    let tokenContractAddress;

    // get chain status
    const chainStatus = await aelf.chain.getChainStatus();
    // get genesis contract address
    const GenesisContractAddress = chainStatus.GenesisContractAddress;
    // get genesis contract instance
    const zeroContract = await aelf.chain.contractAt(
      GenesisContractAddress,
      wallet
    );

    // Get contract address by the read only method `GetContractAddressByName` of genesis contract
    tokenContractAddress = await zeroContract.GetContractAddressByName.call(
      AElf.utils.sha256(tokenContractName)
    );

    const tokenContract = await aelf.chain.contractAt(
      tokenContractAddress,
      wallet
    );

    const { balance } = await tokenContract.GetBalance.call({
      symbol: "ELF",
      owner: WALLET_ADDRESS,
    });

    if (balance === "0") {
      throw new Error(
        "Please claim your tokens from faucet: https://testnet-faucet.aelf.io/"
      );
    }

    const _balance = new BigNumber(balance).dividedBy(10 ** 8).toNumber();

    console.log(`You have ${_balance} ELF.`);

    const fileStr = fs.readFileSync(DLL_FILENAME).toString("base64");

    const { TransactionId } = await zeroContract.DeployUserSmartContract({
      category: 0,
      code: fileStr,
    });
    core.setOutput("deployment-transaction-id", TransactionId);
    console.log(TransactionId);

    const link = `https://explorer-test-side02.aelf.io/tx/${TransactionId}`;

    core.summary
      .addLink("View the transaction on AElf Explorer.", link)
      .write();
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
})();
