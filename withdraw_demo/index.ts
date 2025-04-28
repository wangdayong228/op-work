import { createPublicClient, createWalletClient, http, parseEther, formatEther, defineChain } from 'viem';
import { mainnet, optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  walletActionsL1,
  walletActionsL2,
  publicActionsL1,
  publicActionsL2,
  chainConfig
} from 'viem/op-stack';
import { config } from 'dotenv';

// 加载环境变量
config({ path: ".env" });

// === 1. 初始化账号和客户端 ===

// 私钥需从环境变量中读取，确保是0x开头的十六进制字符串
const PRIVATE_KEY = process.env.op_l2_pk! as `0x${string}`;
console.log('💳 私钥:', PRIVATE_KEY);
// 将私钥转为 Account 对象
const account = privateKeyToAccount(PRIVATE_KEY);
console.log('💳 账户地址:', account.address);
console.log('💳 账户类型:', account.type); // 应该显示 "local"

// === 2. 自定义网络 ===

const sourceId = 3151908 // private-l1

const customL1 = defineChain({
  id: sourceId,
  name: 'Private-ETH-L1',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.op_l1_rpc!],
    },
  },
  blockExplorers: {
    default: {
      name: 'Unsupport',
      url: 'unsupport',
      apiUrl: 'unsupport',
    },
  },
  // contracts: {
  //   ensRegistry: {
  //     address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  //   },
  //   ensUniversalResolver: {
  //     address: '0xce01f8eee7E479C928F8919abD53E553a36CeF67',
  //     blockCreated: 19_258_213,
  //   },
  //   multicall3: {
  //     address: '0xca11bde05977b3631167028862be2a173976ca11',
  //     blockCreated: 14_353_601,
  //   },
  // },
})

const customL2 = defineChain({
  ...chainConfig,
  id: 2151908,
  name: 'Private-OP-L2',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.op_l2_rpc!],
    },
  },
  blockExplorers: {
    default: {
      name: 'Optimism Explorer',
      url: 'http://127.0.0.1:21300',
      apiUrl: 'unspoort',
    },
  },
  contracts: {
    ...chainConfig.contracts,
    disputeGameFactory: {
      [sourceId]: {
        address: '0x71d9cc7dc50c6d2c3f6d9e086a577d06f48969e8',
      },
    },
    l2OutputOracle: {
      [sourceId]: {
        address: '0x0000000000000000000000000000000000000000',
      },
    },
    multicall3: {
      address: '0x0000000000000000000000000000000000000000',
      blockCreated: 0,
    },
    portal: {
      [sourceId]: {
        address: '0xae0896e26482ef9b92735aa8a490447b04c32673',
      },
    },
    l1StandardBridge: {
      [sourceId]: {
        address: '0x5b8f683222b3e059283828a4e91c215d77dcc058',
      },
    },
  },
  sourceId,
})

// 创建 L1（以太坊）只读客户端，并扩展公有 L1 操作
const publicClientL1 = createPublicClient({
  chain: customL1,
  transport: http(process.env.op_l1_rpc!)
}).extend(publicActionsL1());

// 创建 L1（以太坊）签名客户端，并扩展钱包 L1 操作
const walletClientL1 = createWalletClient({
  account,
  chain: customL1,
  transport: http(process.env.op_l1_rpc!),
  // 关键设置：强制使用本地签名
  key: 'local',
}).extend(walletActionsL1());
// const publicClientL1 = walletClientL1;

// 创建 L2（Optimism）只读客户端，并扩展公有 L2 操作
const publicClientL2 = createPublicClient({
  chain: customL2,
  transport: http()
}).extend(publicActionsL2());

// 创建 L2（Optimism）签名客户端，并扩展钱包 L2 操作
const walletClientL2 = createWalletClient({
  account: account,
  chain: customL2,
  transport: http(),
  // 关键设置：强制使用本地签名
  key: 'local',
}).extend(walletActionsL2());

/**
 * 完整提现流程：L2 发起 → 等待上链 → 等待可证明 → 提交证明 → 等待可完成 → finalize
 * @param amount Wei 单位的提现金额
 */
async function withdraw(amount: bigint) {
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

  console.log('\n--- 3. 等待 L2 交易确认 ---');
  // Wait for the initiate withdrawal transaction receipt.
  const receipt = await publicClientL2.waitForTransactionReceipt({ hash });
  console.log(`✅ L2 交易已确认, 区块高度: ${receipt.blockNumber}`);
  console.log(`   Gas 使用: ${receipt.gasUsed}`);

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

  console.log('\n--- 5. 构建证明参数 ---');
  // Build parameters to prove the withdrawal on the L2.
  const proveArgs = await publicClientL2.buildProveWithdrawal({
    output,
    withdrawal,
  });
  console.log('✅ 证明参数构建完成');

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

  // 检查 L1 余额变化
  const l1Balance = await publicClientL1.getBalance({ address: account.address });
  console.log(`\n💰 提现后 L1 余额: ${formatEther(l1Balance)} ETH`);

  console.log('\n=== 🎉 提现流程完成 ===');
}

// 示例调用：提现 0.01 ETH（1e16 Wei）
withdraw(parseEther('0.01'));
