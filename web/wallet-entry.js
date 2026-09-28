import './beltrix-local-wallet.js';
import './wallet.js';
import { installWalletUx } from './wallet-ux.js';

installWalletUx();

import {installFundingUI} from './funding-ui.js';
installFundingUI();

import {installUsdtLauncher} from './usdt-launcher.js';
installUsdtLauncher();

import {installBeltrixLocalWalletUI} from './beltrix-local-wallet-ui.js';
installBeltrixLocalWalletUI();
