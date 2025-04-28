import { formatEther, parseEther } from "viem";
import { account, publicClientL1, publicClientL2, walletClientL2 } from "./config";

/**
 * 完整提现流程：L2 发起 → 等待上链 → 等待可证明 → 提交证明 → 等待可完成 → finalize
 * @param amount Wei 单位的提现金额
 */
async function startWithdraw(amount: bigint) {
    console.log('=== 提现流程开始 ===');
    console.log(`📤 提现金额: ${formatEther(amount)} ETH (${amount} Wei)`);
  
    // 检查余额
    const l2Balance = await publicClientL2.getBalance({ address: account.address });
    console.log(`💰 当前 L2 余额: ${formatEther(l2Balance)} ETH`);
  
    if (l2Balance < amount) {
      console.error(`❌ 错误: L2 余额不足, 需要 ${formatEther(amount)} ETH, 但只有 ${formatEther(l2Balance)} ETH`);
      return;
    }
  
    console.log('\n--- 1. 构建提现参数 ---');
    // Build parameters to initiate the withdrawal transaction on the L1.
    const args = await publicClientL1.buildInitiateWithdrawal({
      account: account,
      to: account.address,
      value: amount
    });
    console.log('✅ 提现参数构建完成');
  
    console.log('\n--- 2. 在 L2 执行提现发起交易 ---');
    // Execute the initiate withdrawal transaction on the L2.
    const hash = await walletClientL2.initiateWithdrawal(args);
    console.log(`📝 L2 提现交易已发送, 交易哈希: ${hash}`);
}  

startWithdraw(parseEther('0.001'));