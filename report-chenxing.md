
# 一带一路侧链进展报告

目前已启动两条基于以太坊兼容的 Layer 2 链：Polygon zkEVM 和 OP Stack，用于推动“一带一路”区块链侧链项目。为实现兼容，我们开发了 Conflux JSON-RPC Proxy 服务，支持 WebSocket 并完成了与以太坊 Block Hash 的映射，适配了多个核心 RPC 接口，确保 L2 正常运行。

Polygon zkEVM 已完成部署，解决了合约部署、Gas 估算、Batch 卡顿等多个问题，但仍存在 Batch 编号运行数天后卡顿的问题待排查。OP Stack 也顺利部署，修复了多项兼容性问题，包括区块派生、Batch 发送及交易打包延迟等，目前主要剩下 challenger 批处理和 L2 每小时重组的问题正在解决中。

此外，已完成 L2 → L1 跨链提现演示，并开展初步压测。Polygon zkEVM 在资源允许下 TPS 可超百，OP Stack 压测待开展。整体来看，项目技术路线清晰，基础设施逐步稳定，为后续规模化应用奠定了良好基础

## 启动的 Layer 2 项目

- **Polygon zkEVM**
- **OP Stack**

> 这两个 L2 都要求 Ethereum 兼容，因此开发了一个 **Conflux JSON-RPC Proxy** 服务以提供兼容支持。

---

## Conflux JSON-RPC Proxy 功能

1. **支持 WebSocket**
2. **Block Hash 计算方式适配**：将 Conflux Block Hash 映射为 Ethereum Block Hash  
   - 查询区块时返回 Ethereum Block Hash  
   - 当 RPC 入参包含 Block Hash 时，转换为 Conflux Block Hash
   - 适配的 RPC 方法：
     - `eth_transactionCount`
     - `eth_getBalance`
     - `eth_getCode`
     - `eth_getStorageAt`
     - `eth_getBlockByNumber`
     - `eth_getBlockByHash`
     - `eth_call`
     - `eth_getBlockReceipts`
3. **`eth_feeHistory` 响应处理**：由于 OP Stack 要求 `baseFeePerGas > 1 Gwei`，作了特别适配

---

## Polygon zkEVM 部署进展

### 部署方式

- 使用 **kurtosis-cdk** 进行部署

### 已解决问题

- **合约部署相关**
  - L1 使用 `create2` 时未重置 `salt` 导致部署失败 → 每次部署前重置
  - L1 Gas 估算方式不一致 → 使用 Double Gas 值解决
- **Batch 处理**
  - `batchNumber` 正常增长，`virtualBatchNumber` 和 `verifiedBatchNumber` 固定 → 适配 block hash 计算方式后解决
- **Sequencer 卡顿问题** → 提高 gas price 解决
- **`zkevm_verifiedBatchNumber` 卡顿**  
  → 原因：agglayer 发送交易卡主  
  → 解决方案：将结算端设置为 L1，绕过 agglayer

### 尚未解决问题

- `zkevm_verifiedBatchNumber` 和 `zkevm_virtualBatchNumber` 运行几天后再次卡主，原因待查

---

## OP Stack 部署进展

### 部署方式

- 使用 **kurtosis**
- 使用的仓库：`optimism-package`

### 已解决问题

- **L2 区块派生时多次校验 Block Hash** → 通过 proxy 映射为 Ethereum Block Hash 解决
- **RPC 参数包含 Block Hash 的适配问题** → 使用 proxy 实现兼容
- **`op-node` 检查 L1 Block 的 `parentHash`**  
  → 暂时跳过检查，后续由 proxy 处理
- **`op-batcher` 的 `blobGasFee` 为 nil 导致 panic** → 设置 nil 返回值为 1 解决
- **默认发送 blob 交易问题** → 修改 `network_params.yaml`，配置：
  ```yaml
  --data-availability-type=calldata
  ```
- **Calldata Gas 不足导致交易失败**
  → 由于 gas 估算不同，使用 gas 对齐的私链规避该问题
- **Prometheus 启动超时问题** → 修改 `prometheus.yml.tmpl`，删除 `fallback_scrape_protocol`
- **交易无法打包问题**
  - 原因：L1 出块太快，L2 每块只更新一次 L1 origin → 导致 L1 与 L2 区块差距拉大
  - 解决方案：统一将 L1/L2 出块时间都设置为 **1 秒**
- **出块变慢问题**
  - 原因：RPC 响应太慢
  - 解决方案：jsonrpc-proxy 使用 **SQLite** 存储 blockhash 映射

### 尚未解决问题

- `op-challenger` 使用 Batch RPC，尚未完成 proxy 适配
- L2 每小时发生一次 reorg，正在调查

### 其他补充

- 调整 L2 → L1 跨链时间为 **10 分钟**（在 Ethereum 私链为 L1 的场景下）
- 实现了 **L2 → L1 提现 demo**

---

## 压测情况

### 脚本说明

- 创建脚本：100 个账户并行发送交易

### Polygon zkEVM 压测结果

- 可维持短时间内 TPS > 100
- 机器配置不足导致长时间后 TPS 下降，L2 出块变慢
- 后续将提高配置后重新测试

### OP Stack

- 尚未进行压测
