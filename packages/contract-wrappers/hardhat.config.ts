import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";import "@typechain/hardhat";
import * as path from "path";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  typechain: {
    outDir: "src/typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    externalArtifacts: [
      path.resolve(__dirname, "../contract-artifacts/artifacts/ERC20Token.json"),
      path.resolve(__dirname, "../contract-artifacts/artifacts/IERC20Token.json"),
      path.resolve(__dirname, "../contract-artifacts/artifacts/IEtherToken.json"),
      path.resolve(__dirname, "../contract-artifacts/artifacts/WETH9.json"),
      path.resolve(__dirname, "../contract-artifacts/artifacts/IZeroEx.json"),
      path.resolve(__dirname, "../contract-artifacts/artifacts/IStaking.json"),
      path.resolve(__dirname, "../contract-artifacts/artifacts/ZRXToken.json"),
    ],
    dontOverrideCompile: true
  },
};

export default config; 