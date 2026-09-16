import './wallet.js';
import { installWalletUx } from './wallet-ux.js';

installWalletUx();

import {installFundingUI} from './funding-ui.js';
installFundingUI();

import {installUsdtLauncher} from './usdt-launcher.js';
installUsdtLauncher();
