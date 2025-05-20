# 配置

## 部署合约相关配置

配置所在代码 `optimism/packages/contracts-bedrock/scripts/libraries/Config.sol`

`deployConfigPath` 获取基础配置文件路径（但实际执行时不知道怎么找的）。

<!-- 测试时使用 `optimism/packages/contracts-bedrock/deploy-config/hardhat.json`; 其它使用 `optimism/packages/contracts-bedrock/deploy-config/mainnet.json`。

也可以通过环境变量 `DEPLOY_CONFIG_PATH` 指定。 -->

op-deployer apply 时相关配置为 intent struct，default 值见 `optimism/op-e2e/config/init.go:413`

部署合约时使用的配置文件见 `kurtosis files download op-eth op-deployer-configs ./tmp/op-deployer-configs` 中 intent-merge.json，对应解构体为[Intent](https://github.com/ethereum-optimism/optimism/blob/a79e8cc06aa354511983fafcb6d71ab04cdfadbc/op-deployer/pkg/deployer/state/intent.go#L41)

其中 intent.toml 和 state.json 都是 op-deploy init命令创建的。 op-deploy apply 时会根据 state.json 创建 genisis.json, rollup.json 等文件用于其他组件启动。 其中 rollup.json 就包含 l2 出块时间。 参看[介绍](https://devdocs.optimism.io/op-deployer/reference-guide/architecture.html)

[GlobalDeployOverrides](https://github.com/ethereum-optimism/optimism/blob/7b534540e5bc3e470cf15d8293a40b51590aab8e/op-e2e/config/init.go#L377)是用于覆盖默认 Intent 中的配置


**配置文件修改**
1. 提现等待时间见[这里](#调整-l2-l1-提现时间)
2. 设置配置文件 network_params_cfx.yaml 参数来调整l2出块时间：`optimism_package.chains[0].participants[0].network_params.seconds_per_slot: 1`


## 配置使用外部l1

network_params.yaml 配置文件中配置
```yml
external_l1_network_params:
  network_id: "71"
  rpc_kind: standard
  el_rpc_url: https://opgrafana.conflux123.xyz/rpc
  el_ws_url: ws://opgrafana.conflux123.xyz/ws
  cl_rpc_url: https://opgrafana.conflux123.xyz/rpc
  priv_key: "0x850643a0224065ecce3882673c21f56bcf6eef86274cc21cadff15930b59fc8c"
```

**配置的部署合约到l1管理员账户**
```sh
Private Key 10: 0x850643a0224065ecce3882673c21f56bcf6eef86274cc21cadff15930b59fc8c, Address: 0x65D08a056c17Ae13370565B04cF77D2AfA1cB9FA
```

### 确保 l1 部署了 deterministic-deployment-proxy

这个合约是用来部署确定性地址的合约的。

部署该合约的方法与 1820 类似，repo在[这](https://github.com/Arachnid/deterministic-deployment-proxy)

部署前
1. 先充值到 sender
2. 将 test.sh 中关于 docker 和充值的步骤删掉。

然后根据说明部署即可

# Rpc

所有 rpc 参看 https://docs.optimism.io/operators/node-operators/json-rpc#admin_sequenceractive

- optimism_syncStatus ：查询同步状态
- admin_sequencerActive： 查询 sequencer 是否活动
- optimism_rollupConfig: 查看 l2 配置
- optimism_outputAtBlock: 查看 block 输出信息
# 调试 op-node

对 op-node 增加了调试功能，分别修改了 docker file 和 starlark 文件。

部署 kurtosis 后，本地需要先开始 ssh 隧道，建立本地端口到服务器端口的端口转发。

1. 在本地运行如下命令，其中2345是本地 vscode 的配置端口，33162 是远端服务器的 delve 服务端口（不是 docker容器的 delve服务端口，是映射到服务器宿主机的端口）
```sh
ssh -L 2345:localhost:33162 root@47.83.15.87 -N
```
2. 本地 vscode 启动调试，配置见 `optimism/.vsode/launch.json`

# 关键代码

1. [max_sequencer_drift](https://specs.optimism.io/protocol/derivation.html): 用于限制 sequencer 能领先 L1 的最大时间长度。也就是 L2 head 能领先 L1 orgin 的最大时长。[maxSequencerDriftFjord](https://github.com/wangdayong228/optimism/blob/284913be5aafcf69d18e3508c5e44da7df9fcd76/op-node/rollup/chain_spec.go#L31)为常量，在Fjord分叉后，就不能通过配置读取了，固定值为 1800 秒。
2. withdraw 交易的机制与 OptimismPortal 合约的版本`OptimismPortal.version()`有关，版本小于 3 时使用 l2OutputOracle 获取输出根，>=3 时使用 DisputeGameFactory 机制。（具体细节还未深究）
3. withdraw 交易的争议游戏使用合约为：PermissionedDisputeGame
4. op-deploy init 创建部署配置，kurtosis 使用的op-deploy版本为v0.0.12, 执行的命令为`op-deployer init --intent-config-type custom --l1-chain-id $L1_CHAIN_ID --l2-chain-ids 2151908 --workdir /network-data`
5. [Sequencer.nextAction](https://github.com/ethereum-optimism/optimism/blob/76b92d861722395c6a3a2bc3581699e635ac313b/op-node/rollup/sequencing/sequencer.go#L111) 表示下一个出块时间。日志中“Sequencer action schedule changed”可以看到下一个出块时间还有多久。如果出块慢了wait 可能会是一个比较大的负数。再通过日志可以分析慢的原因。
6. Execution Engine-API 指 op-geth 的 api
7. 每个 L2 区块的第一笔交易都是 L1 Info Transaction，用于关联L1区块。在[PreparePayloadAttributes](https://github.com/ethereum-optimism/optimism/blob/76b92d861722395c6a3a2bc3581699e635ac313b/op-node/rollup/derive/attributes.go#L138)中创建该交易。每隔 1 小时 [reorg](#l2-reorg-日志) 就是关联的 L1 区块信息不匹配导致。
8. `op-deploy apply` 设置 L2 引用的 L1 Block 代码为[SetStartBlockLiveStrategy](https://github.com/ethereum-optimism/optimism/blob/2ad31dfa6f76a0727b8616f28588f58ffa79773c/op-deployer/pkg/deployer/pipeline/start_block.go#L38)。 会保存到 state.json 中的 `opChainDeployments.startBlock`。

# 修改

1. 针对 block parent 等检查修改了 op-node/ op-batcher/ op-proposer; 部署 kurtosis 前确保创建了这些 docker image，命令为`make op-node-docker`,`make op-batcher-docker`,`make op-proposer-docker`
2. op-geth(branch:fork/v1.101503.2-rc.1-fix):  set FloorDataGas to double
3. op-node 修改 [maxSequencerDriftFjord](https://github.com/wangdayong228/optimism/blob/284913be5aafcf69d18e3508c5e44da7df9fcd76/op-node/rollup/chain_spec.go#L31)用于调试。(已恢复到 1800)

## 调整 l2->l1 提现时间
影响提现时间的合约有 `FaultDisputeGame`, `PermissonedDisputeGame` 和 `OptimismPortal`

不同的 [GameType](https://github.com/ethereum-optimism/optimism/blob/c023165711746bece8341b492a9d831a183c89cd/packages/contracts-bedrock/src/dispute/lib/Types.sol#L50)，会使用不同的`DisputeGame`合约，可以通过 `gameImpls(uint32)` 查询对应的合约实现。跨链交易对应的 GameType为 1， 使用的是 `PermissonedDisputeGame`。

`PermissonedDisputeGame` 场景： l2->l1 跨链提现交易
`additional FaultDisputeGame` 场景： *可能*是消息跨链（不太清楚）

涉及的合约变量：
  - OptimismPortal2.sol 合约 DISPUTE_GAME_FINALITY_DELAY_SECONDS：争议解决后依然需要等待的时间
  - OptimismPortal2.sol 合约 PROOF_MATURITY_DELAY_SECONDS： 提款交易被证明后到可以被最终确认之间必须等待的时间延迟，默认值是 3.5 天
  - FaultDisputeGame.sol 合约 MAX_CLOCK_DURATION：游戏必须至少运行这么长时间才能被解析。默认值为 3.5 天
  - FaultDisputeGame.sol 合约 CLOCK_EXTENSION：响应者参加游戏的时间扩展（可加时长度）

### 修改 MAX_CLOCK_DURATION 相关参数
MAX_CLOCK_DURATION 涉及的代码：
MAX_CLOCK_DURATION为部署 `additional dispute game` 和 `permissioned dispute game` 合约 implements 时通过构造函数传入的，该变量是imuttable的，所以部署时是以 **bytecode 硬编码**的。

相关合约代码为
```solidity
        uint256 splitDepthExtension = uint256(_params.clockExtension.raw()) * 2;
        uint256 maxGameDepthExtension =
            uint256(_params.clockExtension.raw()) + uint256(_params.vm.oracle().challengePeriod());
        uint256 maxClockExtension = Math.max(splitDepthExtension, maxGameDepthExtension);

        // The maximum clock extension must fit into a uint64.
        if (maxClockExtension > type(uint64).max) revert InvalidClockExtension();

        // The maximum clock extension may not be greater than the maximum clock duration.
        if (uint64(maxClockExtension) > _params.maxClockDuration.raw()) revert InvalidClockExtension();
```

这里检查条件可简化为： `maxClockExtension > maxClockExtension = Math.max(clockExtension*2, clockExtension+vm.oracle().challengePeriod)`。
所以需要同时设置 `clockExtension` 和 `vm.oracle().challengePeriod`。
而要设置 challengePeriod ，则需要部署自定义oracle合约，而不使用 PreImageOracle合约，go 代码参看[这里](https://github.com/ethereum-optimism/optimism/blob/6823d6768266a4a8ddf435cc2d91bd17ca13e345/op-deployer/pkg/deployer/pipeline/dispute_games.go#L58)。设置 [`ChainIntent.AdditionalDisputeGames[n]`](https://github.com/ethereum-optimism/optimism/blob/ce2ce43b35baa693de75750fc38261aed0ad0b5f/op-deployer/pkg/deployer/state/chain_intent.go#L49) 结构的 useCustomOracle 为 true。

修改 `additional dispute game` 的方式为设置 dangerousAdditionalDisputeGames（见 contract_deploy.star）：
```python
        intent_chain.update(
            {
                "dangerousAdditionalDisputeGames": [
                    {
                        "respectedGameType": 0,
                        "faultGameAbsolutePrestate": absolute_prestate,
                        "faultGameMaxDepth": 73,
                        "faultGameSplitDepth": 30,
                        # "faultGameClockExtension": 10800,
                        # "faultGameMaxClockDuration": 302400,
                        "dangerouslyAllowCustomDisputeParameters": True,
                        "vmType": "CANNON1",
                        "useCustomOracle": True,
                        "oracleMinProposalSize": 0,
                        "oracleChallengePeriodSeconds": 0,
                        # "OracleChallengePeriodSeconds": 1,
                        "makeRespected": False,
                        "faultGameClockExtension": 12,
                        "faultGameMaxClockDuration": 24,
                    }
                ],
            }
        )
```

而修改 `permissioned dispute game` 则需要通过修改 `globalDeployOverrides`（见 contract_deploy.star）：

```json
        "globalDeployOverrides": {
            ...
            "faultGameClockExtension": 12,
            "faultGameMaxClockDuration": 24,
            "preimageOracleChallengePeriod": 0,
        }
```

### 修改 DISPUTE_GAME_FINALITY_DELAY_SECONDS，PROOF_MATURITY_DELAY_SECONDS

contract_deployer.star:113 文件增加了
```json
        "globalDeployOverrides": {
            "proofMaturityDelaySeconds": 12,
            "faultGameWithdrawalDelay": 12,
            "dangerouslyAllowCustomDisputeParameters": True,
            ...
        }
```


# 部署

## 启动 jsonrpc-proxy

op-stack 在 cfx espace testnet 发交易时会因为 gas limit 太大（>1500万）的问题导致交易不打包（辰星说需要调高 gas price 到 10 倍以上才行）。

所以当前使用与 ethereum 相同 gas 版本的 conflux-rust 作为 l1 节点。

op-node 会检查 block hash 是否正确，由于conflux 的 block hash 与 ethereum 计算方式不一致，导致大量检查失败，当前已适配为 
- block 相关 rpc 返回 ethereum 计算的 block hash。
- eth_getBalance/eth_getCode/eth_getBlockReceipts 等 rpc 会将 block hash 参数替换为 block number


**启动命令**

`CORRECT_BLOCK_HASH=true` 表示适配为 ethereum block hash

```sh
JSONRPC_URL=http://47.83.15.87 PORTS=3031 CORRECT_BLOCK_HASH=true pm2 start "node ." --name ecfx-test-eth-gas
```
**重启命令**
```sh
pm2 restart ecfx-test-eth-gas
```

**更新环境变量**
```sh
JSONRPC_URL=http://47.83.15.87 PORTS=3031 CORRECT_BLOCK_HASH=true pm2 restart ecfx-test-eth-gas --update-env
```

## kurtosis 中需要充钱的地址

### deploy-cfx 使用外部 l1 时
cfx-espace-l1-genesis-admin: 9a6d3ba2b0c7514b16a006ee605055d71b9edfad183aeb2d9790e9d4ccced471 0x0e768D12395C8ABFDEdF7b1aEB0Dd1D27d5E2A7F

**配置中l1发交易使用地址**

privateKey: 0x850643a0224065ecce3882673c21f56bcf6eef86274cc21cadff15930b59fc8c
address: 0x65D08a056c17Ae13370565B04cF77D2AfA1cB9FA

**l1部署合约会用到的地址**

手动充 1000eth 到 0xd8f3183def51a987222d845be228e0bbb932c222 

**kurtosis脚本中 hard code 的 faucet 账户**
手动充 1000eth 到 0xafF0CA253b97e54440965855cec0A8a2E2399896

### 通用

**kurtosis脚本中 hard code 了 faucet 账户**

代码： `optimism-package/static_files/scripts/fund.sh:62`
- l1FaucetAddress: 0xafF0CA253b97e54440965855cec0A8a2E2399896
- l2FaucetAddress: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

**梓涵测试跨链的地址**

- l2: 0x180F2613c52c903A0d79B8025D8B14e461b22eF1


# cast 命令

当前在宿主机配置了 l1 rpc, l2 rpc, l1 bridge 等环境变量到 `~/.bashrc`; cast 命令中直接使用环境变量即可

```sh
# 跨 eth 到 l2
cast send --private-key 0xbcdf20249abf0ed6d944c0288fad489e33f66b3960d9e6229c1cd214ed3bbe31 --value 1ether  --rpc-url $op_l1_rpc  $op_l1_bridge

# l2 发交易
cast send --private-key 0xbcdf20249abf0ed6d944c0288fad489e33f66b3960d9e6229c1cd214ed3bbe31 --value 1  --rpc-url $op_l2_rpc 0xE25583099BA105D9ec0A67f5Ae86D90e50036425

# 查 balance
cast balance --rpc-url $op_l2_rpc  0x8943545177806ED17B9F23F0a21ee5948eCaa776
```

# kurtosis 常用命令
```sh
# 查看所有错误日志
kurtosis service logs -f -a op-cfx | grep error
```

# 容器 image

| IMAGE                                                                   | NAMES                                                      |
|-------------------------------------------------------------------------|------------------------------------------------------------|
| grafana/grafana:latest                                                  | grafana--9f07cad71f864a8c9ae5ca6783690700                  |
| prom/prometheus:latest                                                  | prometheus--05b6c5e604ca4d6ba1edbc94110c44a7               |
| us-docker.pkg.dev/oplabs-tools-artifacts/images/op-challenger:develop   | op-challenger-op-kurtosis--6700a97c29ed42c5a79936cda053bad2|
| us-docker.pkg.dev/oplabs-tools-artifacts/images/op-proposer:develop     | op-proposer-op-kurtosis--a9647761274342ea83d734e63aebd021  |
| us-docker.pkg.dev/oplabs-tools-artifacts/images/op-batcher:develop      | op-batcher-op-kurtosis--f45cee3c10e94d518d85b9598a99e63e   |
| us-docker.pkg.dev/oplabs-tools-artifacts/images/op-node:develop         | op-cl-1-op-node-op-geth-op-kurtosis--964a17fba2da448f8a79b0de9ce5159a |
| us-docker.pkg.dev/oplabs-tools-artifacts/images/op-geth:latest          | op-el-1-op-geth-op-node-op-kurtosis--ecbb8bf9ebf44e9696429b984421980b |
| consensys/teku:latest                                                   | cl-1-teku-geth--4f0972bc5df34808897247d778d9d5e7           |
| ethereum/client-go:latest                                               | el-1-geth-teku--e789319463c14fd09da1aad1c0c422ca           |
| protolambda/eth2-val-tools:latest                                       | validator-key-generation-cl-validator-keystore--e60e16148d3c40ee93eb2ff2a5c2e30a |
| kurtosistech/core:2.1.0                                                 | kurtosis-api--699533db8c2f42d583c449fabe58a74d             |
| fluent/fluent-bit:1.9.7                                                 | kurtosis-logs-collector--699533db8c2f42d583c449fabe58a74d  |


# MISC
op-deployer 部署合约时，如下错误是合约版本不一致导致的。

下面错误是在**本地**而不是 kurtosis运行 op-deployer时报的错，可能是由于 本地的bedrock-contracts 版本与 kurtosis 里使用的不一致
```sh
WARN [03-21|10:28:59.948] callframe                                depth=1 byte4=0x522bb704 addr=0xcd6473be2560AcE97068062df850E6f6e6871066 callsite= label=SetDisputeGameImpl
WARN [03-21|10:28:59.948] Revert                                   addr=0xcd6473be2560AcE97068062df850E6f6e6871066 label=SetDisputeGameImpl err="execution reverted" revertMsg="unrecognized 4 byte signature: 6425666b" depth=1
WARN [03-21|10:28:59.948] Fault                                    addr=0xcd6473be2560AcE97068062df850E6f6e6871066 label=SetDisputeGameImpl err="execution reverted" depth=1
WARN [03-21|10:28:59.948] callframe                                depth=1 byte4=0x522bb704 addr=0xcd6473be2560AcE97068062df850E6f6e6871066 callsite= label=SetDisputeGameImpl
WARN [03-21|10:28:59.948] Revert                                   addr=0xcd6473be2560AcE97068062df850E6f6e6871066 label=SetDisputeGameImpl err="execution reverted" revertMsg="unrecognized 4 byte 
```

# 遇到的问题
1. op-deployer部署合约问题，参见 misc
2. block hash 校验失败问题，通过 rpc proxy 适配解决
3. eth_getBalance 等 rpc 参数为 block hash 时，conflux 不支持，通过 rpc proxy 适配解决
4. op-node 中会检查  L1 block 的 parent hash，通过修改代码跳过检查解决，需要重新 `make op-node-docker`
5. op-batcher 由于 blobGasFee 为 nil 导致 panic，设置为 nil 则返回1，log见 [op-batch panic](#op-batch-panic)
6. 默认op-batcher发送 batch 到 l1 时为 blob 交易，修改 `network_params.yaml`中 op-batcher 启动参数配置`--data-availability-type=calldata`
7. op-batcher 发送 calldata 交易到 l1 时 gas 计算为 `op-geth/core/state_transition.go FloorDataGas`， 计算结果小于 conflux 链实际需要，修改为 2 倍解决。(optimize 的 go.mod 需要设置 replace 再 build)
8. op-challenger 用到了 batch rpc，适配 rpc proxy 解决中
9. 在 47.83.15.87 机器上， prometheus 服务启动超时，修改[prometheus.yml.tmpl](https://github.com/wangdayong228/prometheus-package/blob/main/static-files/prometheus.yml.tmpl)模板，删除 `fallback_scrape_protocol` 解决。
10. 启动一段时间后无法打包交易（包括L1跨链L2， L2 普通交易），发现问题所在点为设置 L2 的 L1 origin 时获取到的 nextOrign 始终是一个固定值。根本原因是l1产生区块太快，而l2出块时间是 2 秒，而每个块在更新 l1 origin时，只是+1递增的更新，就会导致差距越来越大。所以现在修改l1跟l2的出块都为 1 秒。 l2通过配置完成：`optimism_package.chains[0].participants[0].network_params.seconds_per_slot: 1`
11. 设置l2出块时间 1 秒，但实际上出块慢，发现是 rpc 响应太慢导致的。将 jsonrpc-proxy 修改为使用 sqlite 存储 blockhash 映射解决。


# 需要注意的点
1. L2->L1 提现时，是将 OptimismPortal 合约的ETH 转账给接收者，如果余额不足，该合约调用也不会失败，值是会发一个事件，且不能再提现。 所以需要先从 L1->L2，再提现。（或者充值 eth到 OptimismPortal）



# 涉及的 log

### **桥接 eth 到 l2**

从 kurtosis 部署 log 中查 l1 bridge 地址:
Begin your L2 adventures by depositing some L1 Kurtosis ETH to: 0xb398266ae3269a1eb57346870abfcbf71b5097a9

### op-batch panic
```log
[op-batcher-op-kurtosis] panic: runtime error: invalid memory address or nil pointer dereference
[op-batcher-op-kurtosis] [signal SIGSEGV: segmentation violation code=0x1 addr=0x10 pc=0x5fbfd2]
[op-batcher-op-kurtosis] 
[op-batcher-op-kurtosis] goroutine 164 [running]:
[op-batcher-op-kurtosis] math/big.(*Int).Float64(0xc00005ef90?)
[op-batcher-op-kurtosis]        /usr/local/go/src/math/big/int.go:456 +0x12
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr/metrics.(*TxMetrics).RecordBlobBaseFee(0xc0005aa060, 0x0?)
[op-batcher-op-kurtosis]        /app/op-service/txmgr/metrics/tx_metrics.go:183 +0x1b
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).SuggestGasPriceCaps(0xc000226900, {0x13f2238?, 0xc00007e640?})
[op-batcher-op-kurtosis]        /app/op-service/txmgr/txmgr.go:913 +0x22d
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).craftTx(0xc000226900, {0x13f2238, 0xc00007e640}, {{0x0, 0x0, 0x0}, {0xc0000a26b8, 0x1, 0x1}, 0xc000216700, ...})
[op-batcher-op-kurtosis]        /app/op-service/txmgr/txmgr.go:344 +0x165
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).prepare.func1()
[op-batcher-op-kurtosis]        /app/op-service/txmgr/txmgr.go:325 +0x67
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/retry.Do[...].func1()
[op-batcher-op-kurtosis]        /app/op-service/retry/operation.go:44 +0x22
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/retry.Do0({0x13f2238, 0xc00007e640}, 0x1e, {0x13ea480, 0xc0005882f0}, 0xc00060b780)
[op-batcher-op-kurtosis]        /app/op-service/retry/operation.go:65 +0xf2
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/retry.Do[...]({0x13f2238?, 0xc00007e640?}, 0x10?, {0x13ea480?, 0xc0005882f0?}, 0x0?)
[op-batcher-op-kurtosis]        /app/op-service/retry/operation.go:47 +0x7a
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).prepare(0xc000226900, {0x13f2238, 0xc00007e640}, {{0x0, 0x0, 0x0}, {0xc0000a26b8, 0x1, 0x1}, 0xc000216700, ...})
[op-batcher-op-kurtosis]        /app/op-service/txmgr/txmgr.go:321 +0x110
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).SendAsync(0xc000226900, {0x13f2238?, 0xc00007e500?}, {{0x0, 0x0, 0x0}, {0xc0000a26b8, 0x1, 0x1}, 0xc000216700, ...}, ...)
[op-batcher-op-kurtosis]        /app/op-service/txmgr/txmgr.go:291 +0xfe
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-service/txmgr.(*Queue[...]).Send(0x13f9ac0, {{0xc000584168, 0x458249?, 0x12?}, 0x80?, 0xad?}, {{0x0, 0x0, 0x0}, {0xc0000a26b8, ...}, ...}, ...)
[op-batcher-op-kurtosis]        /app/op-service/txmgr/queue.go:83 +0x1ea
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).sendTx(0xc000124340, {{0xc0001eaf00, 0x1, 0x1}, 0x1}, 0x0, 0xc00007e460, {0x13e9da0, 0xc00017e640}, 0xc0001083c0)
[op-batcher-op-kurtosis]        /app/op-batcher/batcher/driver.go:901 +0x2da
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).sendTransaction(0xc000124340, {{0xc0001eaf00, 0x1, 0x1}, 0x1}, 0xc00017e640, 0xc0001083c0, 0x83798dc31cc3cde?)
[op-batcher-op-kurtosis]        /app/op-batcher/batcher/driver.go:882 +0x1f3
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).publishTxToL1(0xc000124340, {0x13f2238?, 0xc00017e4b0?}, 0xc00017e640, 0xc0001083c0, 0xc000554a80)
[op-batcher-op-kurtosis]        /app/op-batcher/batcher/driver.go:763 +0x43f
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).publishStateToL1(0xc000124340, {0x13f2238, 0xc00017e4b0}, 0xc00017e640, 0xc0001083c0, 0xc000554a80)
[op-batcher-op-kurtosis]        /app/op-batcher/batcher/driver.go:686 +0xb7
[op-batcher-op-kurtosis] github.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).publishingLoop(0xc000124340, {0x13f2238, 0xc00017e4b0}, 0x0?, 0xc0001083c0, 0xc000108480)
[op-batcher-op-kurtosis]        /app/op-batcher/batcher/driver.go:467 +0x1d9
[op-batcher-op-kurtosis] created by github.com/ethereum-optimism/optimism/op-b
```

### op-batch submit batch tx 失败
```log
t=2025-05-18T10:19:22+0000 lvl=warn msg="Failed to create a transaction, will retry" service=batcher err="failed to call: not enough gas limit with respected to tx size: expected 6054900 got 4871880, reason: <nil>" stack="goroutine 37 [running]:\nruntime/debug.Stack()\n\t/usr/local/go/src/runtime/debug/stack.go:24 +0x5e\ngithub.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).prepare.func1()\n\t/app/op-service/txmgr/txmgr.go:328 +0x8a\ngithub.com/ethereum-optimism/optimism/op-service/retry.Do[...].func1()\n\t/app/op-service/retry/operation.go:44 +0x22\ngithub.com/ethereum-optimism/optimism/op-service/retry.Do0({0x13f24f8, 0xc00007f900}, 0x1e, {0x13ea740, 0xc0012d7660}, 0xc00068f780)\n\t/app/op-service/retry/operation.go:65 +0xf2\ngithub.com/ethereum-optimism/optimism/op-service/retry.Do[...]({0x13f24f8?, 0xc00007f900?}, 0x10?, {0x13ea740?, 0xc0012d7660?}, 0x0?)\n\t/app/op-service/retry/operation.go:47 +0x7a\ngithub.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).prepare(0xc00078e1b0, {0x13f24f8, 0xc00007f900}, {{0xc00151c000, 0xec85, 0xec85}, {0x0, 0x0, 0x0}, 0xc0001e0520, ...})\n\t/app/op-service/txmgr/txmgr.go:322 +0x110\ngithub.com/ethereum-optimism/optimism/op-service/txmgr.(*SimpleTxManager).SendAsync(0xc00078e1b0, {0x13f24f8?, 0xc00007f860?}, {{0xc00151c000, 0xec85, 0xec85}, {0x0, 0x0, 0x0}, 0xc0001e0520, ...}, ...)\n\t/app/op-service/txmgr/txmgr.go:292 +0xfe\ngithub.com/ethereum-optimism/optimism/op-service/txmgr.(*Queue[...]).Send(0x13f9d80, {{0xc000d151d0, 0x458249?, 0x12?}, 0xa0?, 0xac?}, {{0xc00151c000, 0xec85, 0xec85}, {0x0, ...}, ...}, ...)\n\t/app/op-service/txmgr/queue.go:83 +0x1ea\ngithub.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).sendTx(0xc0001124e0, {{0xc000b22240, 0x1, 0x1}, 0x0}, 0x0, 0xc00007f810, {0x13ea040, 0xc0001d6960}, 0xc00025c780)\n\t/app/op-batcher/batcher/driver.go:901 +0x2da\ngithub.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).sendTransaction(0xc0001124e0, {{0xc000b22240, 0x1, 0x1}, 0x0}, 0xc0001d6960, 0xc00025c780, 0x7b7f0c899a0ac25b?)\n\t/app/op-batcher/batcher/driver.go:882 +0x1f3\ngithub.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).publishTxToL1(0xc0001124e0, {0x13f24f8?, 0xc000114eb0?}, 0xc0001d6960, 0xc00025c780, 0xc00019a300)\n\t/app/op-batcher/batcher/driver.go:763 +0x43f\ngithub.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).publishStateToL1(0xc0001124e0, {0x13f24f8, 0xc000114eb0}, 0xc0001d6960, 0xc00025c780, 0xc00019a300)\n\t/app/op-batcher/batcher/driver.go:686 +0xb7\ngithub.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).publishingLoop(0xc0001124e0, {0x13f24f8, 0xc000114eb0}, 0xc0005f2fd0?, 0xc00025c780, 0xc00025c7e0)\n\t/app/op-batcher/batcher/driver.go:467 +0x1d9\ncreated by github.com/ethereum-optimism/optimism/op-batcher/batcher.(*BatchSubmitter).StartBatchSubmitting in goroutine 1\n\t/app/op-batcher/batcher/driver.go:176 +0x578\n"
```
### L2 reorg 日志
```log
t=2025-05-09T02:19:03+0000 lvl=warn msg="L2 reorg: existing unsafe block does not match derived attributes from L1" err="transaction 0 does not match. 
```