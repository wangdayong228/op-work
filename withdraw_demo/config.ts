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

export {
    account,
    customL1,
    customL2,
    publicClientL1,
    walletClientL1,
    publicClientL2,
    walletClientL2,
};