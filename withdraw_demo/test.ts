import { formatEther, parseEther } from "viem";
import { account, publicClientL1, publicClientL2, walletClientL2 } from "./config";
import { inspect } from 'util';
/**
 * 完整提现流程：L2 发起 → 等待上链 → 等待可证明 → 提交证明 → 等待可完成 → finalize
 * @param amount Wei 单位的提现金额
 */
async function getGames() {
    // Execute the initiate withdrawal transaction on the L2.
    const games = await publicClientL1.getGames({ targetChain: publicClientL2.chain });
    console.log(`🎮 获取到的游戏列表: ${inspect(games)}`);
}

async function getGame() {
    // Execute the initiate withdrawal transaction on the L2.
    const game = await publicClientL1.getGame({ targetChain: publicClientL2.chain, l2BlockNumber: 99458n });
    console.log(`🎮 获取到的游戏列表: ${inspect(game)}`);
}

getGame();