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
import dotenv from 'dotenv';

// 加载环境变量
const result = dotenv.config({ override: true });
if (result.error) {
    throw result.error;
}

// === 1. 初始化账号和客户端 ===

// 私钥需从环境变量中读取，确保是0x开头的十六进制字符串
const PRIVATE_KEY = process.env.op_l2_pk! as `0x${string}`;

// 将私钥转为 Account 对象
const account = privateKeyToAccount(PRIVATE_KEY);

// === 2. 自定义网络 ===

const sourceId = 1025 //3151908 // private-l1

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
                address: process.env.dispute_game_factory! as `0x${string}`,
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
                address: process.env.portal! as `0x${string}`,
            },
        },
        l1StandardBridge: {
            [sourceId]: {
                address: process.env.l1_standard_bridge! as `0x${string}`,
            },
        },
    },
    sourceId,
})

// 打印 customL1 和 customL2 链配置信息的函数
function printConfigInfos() {
    console.log('💳 私钥:', PRIVATE_KEY);
    console.log('💳 账户地址:', account.address);
    console.log('💳 账户类型:', account.type);

    console.log('\n=== L1 链配置信息 ===');
    console.log(`链ID: ${customL1.id}`);
    console.log(`链名称: ${customL1.name}`);
    console.log(`原生货币: ${customL1.nativeCurrency.name} (${customL1.nativeCurrency.symbol})`);
    console.log(`RPC URL: ${customL1.rpcUrls.default.http[0]}`);

    console.log('\n=== L2 链配置信息 ===');
    console.log(`链ID: ${customL2.id}`);
    console.log(`链名称: ${customL2.name}`);
    console.log(`原生货币: ${customL2.nativeCurrency.name} (${customL2.nativeCurrency.symbol})`);
    console.log(`RPC URL: ${customL2.rpcUrls.default.http[0]}`);
    console.log(`源链ID: ${customL2.sourceId}`);
    console.log('合约地址:');
    console.log(`  disputeGameFactory: ${customL2.contracts?.disputeGameFactory?.[sourceId]?.address || '未设置'}`);
    console.log(`  portal: ${customL2.contracts?.portal?.[sourceId]?.address || '未设置'}`);
    console.log(`  l1StandardBridge: ${customL2.contracts?.l1StandardBridge?.[sourceId]?.address || '未设置'}`);
    console.log(`  l2OutputOracle: ${customL2.contracts?.l2OutputOracle?.[sourceId]?.address || '未设置'}`);
}

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

// 导出打印函数以便在其他模块中使用
printConfigInfos();

export {
    account,
    customL1,
    customL2,
    publicClientL1,
    walletClientL1,
    publicClientL2,
    walletClientL2,
};