# op-node 与 op-geth 的出块分工

在 Optimism 架构中，出块涉及 op-node 和 op-geth 两个组件，但它们承担不同的角色和职责：

## op-node 与 op-geth 的分工

### op-node 的职责
- **决定区块内容和顺序**：确定哪些交易应该被包含在区块中
- **准备区块参数**：生成区块的 `PayloadAttributes`，包括时间戳、父区块、交易列表等
- **排序和驱动区块创建流程**：作为排序器(Sequencer)控制整个出块流程
- **从 L1 派生数据**：处理来自 L1 的交易和信息

### op-geth 的职责
- **实际执行区块构建**：根据 op-node 提供的参数构建区块
- **执行交易**：运行 EVM 执行交易并更新状态
- **维护区块链状态**：管理世界状态、存储和区块链数据
- **提供执行结果**：返回构建完成的区块给 op-node

## 出块流程

1. op-node 确定需要出块时，准备 `PayloadAttributes`
2. op-node 通过 Engine API 调用 `engine_forkchoiceUpdatedV*` 方法，附带 `PayloadAttributes`
3. op-geth 收到请求后开始构建区块，返回 `payloadID`
4. op-node 稍后通过 `engine_getPayloadV*` 获取 op-geth 构建好的完整区块
5. op-node 对区块进行验证，并通过 `engine_newPayloadV*` 让 op-geth 执行和验证这个区块
6. 最后 op-node 通过另一个 `engine_forkchoiceUpdatedV*` 调用让 op-geth 将这个区块设为规范链头

从技术上讲，op-geth 负责实际的"出块"操作（区块构建和执行），但 op-node 控制整个过程并决定区块内容。这种分离设计遵循了以太坊 PoS 中共识层和执行层的分工模式。

因此，准确地说：**op-geth 负责实际构建和执行区块，而 op-node 负责控制出块流程和决定区块内容**。 