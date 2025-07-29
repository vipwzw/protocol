import * as DummyERC20Token from '../artifacts/DummyERC20Token.json';
import * as ERC20Token from '../artifacts/ERC20Token.json';
import * as IERC20Token from '../artifacts/IERC20Token.json';
import * as IEtherToken from '../artifacts/IEtherToken.json';
import * as IZeroEx from '../artifacts/IZeroEx.json';
import * as WETH9 from '../artifacts/WETH9.json';
import * as ZRXToken from '../artifacts/ZRXToken.json';
import * as LibERC20Token from '../artifacts/LibERC20Token.json';
// Token 已合并到 ERC20Token
import * as UnlimitedAllowanceToken from '../artifacts/UnlimitedAllowanceToken.json';

// Core contracts
export {
    DummyERC20Token,
    ERC20Token,
    IERC20Token,
    IEtherToken,
    IZeroEx,
    WETH9,
    ZRXToken,
    LibERC20Token,
    UnlimitedAllowanceToken,
    // Token 别名指向 ERC20Token
    ERC20Token as Token,
};
