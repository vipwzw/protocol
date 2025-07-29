import * as DummyERC20Token from '../artifacts/DummyERC20Token.json';
import * as ERC20Token from '../artifacts/ERC20Token.json';
import * as IERC20Token from '../artifacts/IERC20Token.json';
import * as IEtherToken from '../artifacts/IEtherToken.json';
import * as IZeroEx from '../artifacts/IZeroEx.json';
import * as WETH9 from '../artifacts/WETH9.json';
import * as ZRXWrappedToken from '../artifacts/ZRXWrappedToken.json';
import * as LibERC20Token from '../artifacts/LibERC20Token.json';
import * as UnlimitedAllowanceERC20Token from '../artifacts/UnlimitedAllowanceERC20Token.json';

// Core contracts
export {
    DummyERC20Token,
    ERC20Token,
    IERC20Token,
    IEtherToken,
    IZeroEx,
    WETH9,
    ZRXWrappedToken,
    LibERC20Token,
    UnlimitedAllowanceERC20Token,
    // 别名保持向后兼容性
    ERC20Token as Token,
    ZRXWrappedToken as ZRXToken,
    UnlimitedAllowanceERC20Token as UnlimitedAllowanceToken,
};
