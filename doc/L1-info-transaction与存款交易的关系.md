# L1 info transaction 与存款交易的关系

在 Optimism 的架构中，L1 info transaction 和存款交易 (deposit transaction) 都是特殊类型的交易，它们在出块流程中扮演不同但相关的角色。本文档分析它们的关系和区别。

## 技术实现

### 共同点

1. **相同的交易类型**：从技术实现上看，L1 info transaction 和存款交易都是 `types.DepositTx` 类型的交易：

```go
// L1InfoDeposit 函数创建的是 DepositTx 类型
func L1InfoDeposit(rollupCfg *rollup.Config, sysCfg eth.SystemConfig, seqNumber uint64, block eth.BlockInfo, l2Timestamp uint64) (*types.DepositTx, error) {
    // ...
    out := &types.DepositTx{
        SourceHash:          source.SourceHash(),
        From:                L1InfoDepositerAddress,
        To:                  &L1BlockAddress,
        Mint:                nil,
        Value:               big.NewInt(0),
        Gas:                 150_000_000,
        IsSystemTransaction: true,
        Data:                data,
    }
    // ...
    return out, nil
}
```

2. **跨层通信**：它们都是 L1 和 L2 之间通信的机制，将 L1 的信息或操作带入 L2 系统。

3. **不需要支付手续费**：两者都是系统交易，不需要由用户支付 gas 费用。

### 根本区别

尽管它们使用了相同的交易类型，但目的和内容完全不同：

1. **来源不同**：
   - L1 info transaction：由排序器（op-node）在每个区块创建，包含与具体 L1 区块相关的元数据。
   - 存款交易：源自用户在 L1 上与存款合约的交互，代表用户从 L1 向 L2 转移资产或触发操作。

2. **内容不同**：
   - L1 info transaction：包含 L1 区块编号、时间戳、base fee、区块哈希等元数据。
   - 存款交易：包含用户地址、转账金额、调用数据等实际交易信息。

3. **在区块中的位置**：
   - L1 info transaction：总是区块中的第一笔交易。
   - 存款交易：紧随 L1 info transaction 之后。

## 创建过程

### L1 info transaction 的创建

在 `attributes.go` 中，排序器为每个区块创建 L1 info transaction，始终作为第一笔交易：

```go
l1InfoTx, err := L1InfoDepositBytes(ba.rollupCfg, sysConfig, seqNumber, l1Info, nextL2Time)
if err != nil {
    return nil, NewCriticalError(fmt.Errorf("failed to create l1InfoTx: %w", err))
}

// 创建交易列表，L1 info transaction 总是第一笔
txs := make([]hexutil.Bytes, 0, 1+len(depositTxs)+len(afterForceIncludeTxs)+len(upgradeTxs))
txs = append(txs, l1InfoTx)
txs = append(txs, depositTxs...)  // 存款交易紧随其后
// ...
```

### 存款交易的创建

存款交易从 L1 上的事件日志中派生：

```go
// deposits.go
func UserDeposits(receipts []*types.Receipt, depositContractAddr common.Address) ([]*types.DepositTx, error) {
    var out []*types.DepositTx
    for _, rec := range receipts {
        if rec.Status != types.ReceiptStatusSuccessful {
            continue
        }
        for _, log := range rec.Logs {
            if log.Address == depositContractAddr && len(log.Topics) > 0 && log.Topics[0] == DepositEventABIHash {
                dep, err := UnmarshalDepositLogEvent(log)
                if err != nil {
                    // ...
                } else {
                    out = append(out, dep)
                }
            }
        }
    }
    return out, result
}
```

## 在出块流程中的作用

### 两者的协作关系

在 Optimism 的出块流程中，L1 info transaction 和存款交易协同工作，确保 L2 区块正确反映 L1 状态和用户操作：

1. **L1 info transaction** 链接 L1 和 L2 区块，提供时序和元数据信息，使 L2 链可以正确引用 L1 链。

2. **存款交易** 允许用户从 L1 发起操作到 L2，无需等待排序器确认，实现了安全且无需信任的资产和信息跨层传输。

### 内部流程

在区块准备阶段：

1. 如果检测到 L1 源区块变化，通过 `DeriveDeposits` 函数从 L1 区块收据中提取用户存款。
2. 无论是否有存款，都会创建一个 L1 info transaction。
3. 构建最终的交易列表，顺序是：
   - L1 info transaction (总是第一个)
   - 存款交易 (如果有的话)
   - 升级交易 (如果是特殊的升级区块)

## 总结

L1 info transaction 和存款交易虽然都使用 `DepositTx` 类型实现，但服务于不同目的：

- **L1 info transaction** 是系统创建的元数据交易，提供区块关联信息。
- **存款交易** 是用户发起的实际操作，从 L1 传输到 L2。

它们一起构成了 Optimism 的跨层通信基础设施，确保了 L2 与 L1 之间的安全关联和数据流动。L1 info transaction 可以被视为 Optimism 区块的"定位锚"，而存款交易则是用户跨层操作的载体。 