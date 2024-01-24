const core = require("@actions/core");
// const github = require("@actions/github");
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
      throw new Error("Please claim your tokens from faucet");
    }

    const _balance = new BigNumber(balance).dividedBy(10 ** 8).toNumber();

    console.log(`You have ${_balance} ELF.`);

    const fileStr = fs.readFileSync(DLL_FILENAME).toString("base64");

    const currentBlockHeight = await aelf.chain.getBlockHeight();
    console.log(currentBlockHeight, "--currentBlockHeight");

    const { BlockHash: currentBlockHash } = await aelf.chain.getBlockByHeight(
      currentBlockHeight,
      false
    );
    console.log(currentBlockHash, "--currentBlockHash");
    core.setOutput("block-hash", currentBlockHash);

    await zeroContract.DeployUserSmartContract({
      category: 0,
      code: fileStr,
    });
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
})();
