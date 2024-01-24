const core = require("@actions/core");
// const github = require("@actions/github");
const AElf = require("aelf-sdk");
const BigNumber = require("bignumber.js");
const fs = require("fs");

async function getProto(aelf, address) {
  return AElf.pbjs.Root.fromDescriptor(
    await aelf.chain.getContractFileDescriptorSet(address)
  );
}

async function deserializeLogs(aelf, logs = []) {
  if (!logs || logs.length === 0) {
    return null;
  }
  let results = await Promise.all(logs.map((v) => getProto(aelf, v.Address)));
  results = results.map((proto, index) => {
    const { Name: dataTypeName, NonIndexed, Indexed = [] } = logs[index];
    const serializedData = [...(Indexed || [])];
    if (NonIndexed) {
      serializedData.push(NonIndexed);
    }
    const dataType = proto.lookupType(dataTypeName);
    let deserializeLogResult = serializedData.reduce((acc, v) => {
      let deserialize = dataType.decode(Buffer.from(v, "base64"));
      deserialize = dataType.toObject(deserialize, {
        enums: String, // enums as string names
        longs: String, // longs as strings (requires long.js)
        bytes: String, // bytes as base64 encoded strings
        defaults: false, // includes default values
        arrays: true, // populates empty arrays (repeated fields) even if defaults=false
        objects: true, // populates empty objects (map fields) even if defaults=false
        oneofs: true, // includes virtual oneof fields set to the present field's name
      });
      return {
        ...acc,
        ...deserialize,
      };
    }, {});
    // eslint-disable-next-line max-len
    deserializeLogResult = AElf.utils.transform.transform(
      dataType,
      deserializeLogResult,
      AElf.utils.transform.OUTPUT_TRANSFORMERS
    );
    deserializeLogResult = AElf.utils.transform.transformArrayToMap(
      dataType,
      deserializeLogResult
    );
    return deserializeLogResult;
  });
  return results;
}

(async () => {
  try {
    const PRIVATE_KEY = core.getInput("private-key");
    const WALLET_ADDRESS = core.getInput("wallet-address");
    const DLL_FILENAME = core.getInput("dll-filename");
    const NODE_URL = core.getInput("node-url");
    const MAX_BLOCKS_TO_SCAN = 50;

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

    let currentBlockHeight = await aelf.chain.getBlockHeight(),
      count = 0,
      found = false;

    const { TransactionId } = await zeroContract.DeployUserSmartContract({
      category: 0,
      code: fileStr,
    });

    const res = await aelf.chain.getTxResult(TransactionId);
    const logs = await deserializeLogs(aelf, res.Logs);
    const proposalId = logs?.find(
      (i) => typeof i.proposalId === "string"
    )?.proposalId;

    while (count < MAX_BLOCKS_TO_SCAN && !found) {
      const { BlockHash } = await aelf.chain.getBlockByHeight(
        currentBlockHeight,
        false
      );
      const results = await aelf.chain.getTxResults(BlockHash, 0, 10);

      const target = results.find(
        (result) =>
          result.Transaction.MethodName === "ReleaseApprovedUserSmartContract"
      );

      if (target) {
        const { Logs } = target;
        const logs = await deserializeLogs(aelf, Logs);

        const proposalLog = logs?.find((l) => l.proposalId === proposalId);

        if (proposalLog) {
          const deployedLog = logs?.find(
            (l) => typeof l.contractVersion === "string"
          );

          if (deployedLog) {
            const deployedContractAddress = deployedLog.address;
            console.log(deployedContractAddress);
            found = true;
            core.setOutput(
              "deployed-contract-address",
              deployedContractAddress
            );

            const link = `https://explorer-test-side02.aelf.io/address/${deployedContractAddress}#contract`;
            console.log(`Visit ${link} to view the contract on AElf Explorer.`);

            core.summary
              .addLink("View the contract on AElf Explorer.", link)
              .write();
          }
        }
      }

      currentBlockHeight++;
      count++;
    }
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
})();
