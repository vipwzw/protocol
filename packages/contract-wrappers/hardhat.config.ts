import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";

const config: HardhatUserConfig = {
  // 不需要完整的 Hardhat 项目设置，只用于 TypeChain 生成
  solidity: "0.8.28",
  typechain: {
    outDir: "src/typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    externalArtifacts: [
      "../contract-artifacts/artifacts/ERC20Token.json",
      "../contract-artifacts/artifacts/IERC20Token.json",
      "../contract-artifacts/artifacts/IEtherToken.json",
      "../contract-artifacts/artifacts/WETH9.json",
      "../contract-artifacts/artifacts/IZeroEx.json",
      "../contract-artifacts/artifacts/IStaking.json",
      "../contract-artifacts/artifacts/ZRXToken.json"
    ],
    dontOverrideCompile: true // 不要覆盖编译任务，因为我们只用于类型生成
  },
};

export default config; 