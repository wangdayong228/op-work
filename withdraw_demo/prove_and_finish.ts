import { formatEther, TransactionReceipt } from "viem";
import { account, customL2, publicClientL1, publicClientL2, walletClientL1, walletClientL2 } from "./config";
import { inspect } from 'util';

/**
 * 完整提现流程：L2 发起 → 等待上链 → 等待可证明 → 提交证明 → 等待可完成 → finalize
 * @param amount Wei 单位的提现金额
 */
async function proveAndFinish(withdrawTxHash: `0x${string}`) {
    console.log('\n--- 3. 等待 L2 交易确认 ---');
    // Wait for the initiate withdrawal transaction receipt.
    const receipt = await publicClientL2.waitForTransactionReceipt({ hash: withdrawTxHash });
    console.log(`✅ L2 交易已确认, 区块高度: ${receipt.blockNumber}`);
    console.log(`   Gas 使用: ${receipt.gasUsed}`);
    console.log('📄 交易收据详情:');
    console.log(inspect(receipt, { depth: null, colors: true }));

    console.log('\n--- 4. 等待提现进入可证明阶段 ---');
    console.log('⏳ 这可能需要一段时间 (L2 输出提交到 L1)...');
    // Wait until the withdrawal is ready to prove.
    const { output, withdrawal } = await publicClientL1.waitToProve({
      receipt,
      targetChain: customL2
    });
    console.log('🔔 提现已进入可证明阶段!');
    console.log(`   提现哈希: ${withdrawal.withdrawalHash}`);
    console.log(`   L2 块高度: ${output.l2BlockNumber}`);
    console.log('📄 输出详情:');
    console.log(inspect(output, { depth: null, colors: true }));
    console.log('📄 提现详情:');
  console.log(inspect(withdrawal, { depth: null, colors: true }));
  
    console.log('\n--- 5. 构建证明参数 ---');
    // Build parameters to prove the withdrawal on the L2.
    const proveArgs = await publicClientL2.buildProveWithdrawal({
      output,
      withdrawal,
    });
    console.log('✅ 证明参数构建完成');
    console.log('📄 证明参数详情:');
    console.log(inspect(proveArgs, { depth: null, colors: true }));
  
    console.log('\n--- 6. 在 L1 提交证明 ---');
    // Prove the withdrawal on the L1.
    const proveHash = await walletClientL1.proveWithdrawal(proveArgs);
    console.log(`📝 L1 证明交易已发送, 交易哈希: ${proveHash}`);
  
    console.log('\n--- 7. 等待证明交易确认 ---');
    // Wait until the prove withdrawal is processed.
    const proveReceipt = await publicClientL1.waitForTransactionReceipt({
      hash: proveHash
    });
    console.log(`✅ L1 证明交易已确认, 区块高度: ${proveReceipt.blockNumber}`);
    console.log(`   Gas 使用: ${proveReceipt.gasUsed}`);
    console.log('📄 证明交易收据详情:');
    console.log(inspect(proveReceipt, { depth: null, colors: true }));
  
    console.log('\n--- 8. 等待提现进入可完成阶段 ---');
    console.log('⏳ 这通常需要 7 天的挑战期...');
    // Wait until the withdrawal is ready to finalize.
    await publicClientL1.waitToFinalize({
      targetChain: walletClientL2.chain,
      withdrawalHash: withdrawal.withdrawalHash,
    });
    console.log('🔔 提现已进入可完成阶段!');
  
    console.log('\n--- 9. 在 L1 完成提现 ---');
    // Finalize the withdrawal.
    const finalizeHash = await walletClientL1.finalizeWithdrawal({
      targetChain: walletClientL2.chain,
      withdrawal,
    });
    console.log(`📝 L1 完成提现交易已发送, 交易哈希: ${finalizeHash}`);
  
    console.log('\n--- 10. 等待完成交易确认 ---');
    // Wait until the withdrawal is finalized.
    const finalizeReceipt = await publicClientL1.waitForTransactionReceipt({
      hash: finalizeHash
    });
    console.log(`✅ L1 完成交易已确认, 区块高度: ${finalizeReceipt.blockNumber}`);
    console.log(`   Gas 使用: ${finalizeReceipt.gasUsed}`);
    console.log('📄 完成交易收据详情:');
    console.log(inspect(finalizeReceipt, { depth: null, colors: true }));
  
    // 检查 L1 余额变化
    const l1Balance = await publicClientL1.getBalance({ address: account.address });
    console.log(`\n💰 提现后 L1 余额: ${formatEther(l1Balance)} ETH`);
  
    console.log('\n=== 🎉 提现流程完成 ===');
  }
  
  proveAndFinish(process.argv[2] as `0x${string}`);