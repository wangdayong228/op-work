# 配置

## 部署合约相关配置

配置所在代码 `optimism/packages/contracts-bedrock/scripts/libraries/Config.sol`

`deployConfigPath` 获取基础配置文件路径（但实际执行时不知道怎么找的）。

<!-- 测试时使用 `optimism/packages/contracts-bedrock/deploy-config/hardhat.json`; 其它使用 `optimism/packages/contracts-bedrock/deploy-config/mainnet.json`。

也可以通过环境变量 `DEPLOY_CONFIG_PATH` 指定。 -->

op-deployer apply 时相关配置为 intent struct，default 值见 `optimism/op-e2e/config/init.go:413`

部署合约时使用的配置文件见 `kurtosis files download op-eth op-deployer-configs ./tmp/op-deployer-configs` 中input-merge.json

我修改提现等待时间是直接修改了 contract_deployer.star:113 文件。增加了
```json
        "globalDeployOverrides": {
            "proofMaturityDelaySeconds": 12,
            "faultGameWithdrawalDelay": 12,
            "dangerouslyAllowCustomDisputeParameters": True,
        }
```



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

# 修改

1. 针对 block parent 等检查修改了 op-node/ op-batcher/ op-proposer; 部署 kurtosis 前确保创建了这些 docker image，命令为`make op-node-docker`,`make op-batcher-docker`,`make op-proposer-docker`
2. op-geth(branch:fork/v1.101503.2-rc.1-fix):  set FloorDataGas to double

# 启动 jsonrpc-proxy

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

# kurtosis 中需要充钱的地址
**配置中l1发交易使用地址**

privateKey: 0x850643a0224065ecce3882673c21f56bcf6eef86274cc21cadff15930b59fc8c
address: 0x65D08a056c17Ae13370565B04cF77D2AfA1cB9FA

**l1部署合约会用到的地址**

手动充 1000eth 到 0xd8f3183def51a987222d845be228e0bbb932c222 

**kurtosis脚本中 hard code 了 faucet 账户**

手动充 1000eth 到 0xafF0CA253b97e54440965855cec0A8a2E2399896

代码： `optimism-package/static_files/scripts/fund.sh:62`
- l1FaucetAddress: 0xafF0CA253b97e54440965855cec0A8a2E2399896
- l2FaucetAddress: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

**梓涵测试跨链的地址**

- l2: 0x180F2613c52c903A0d79B8025D8B14e461b22eF1

# 关键日志

**桥接 eth 到 l2**

从 kurtosis 部署 log 中查 l1 bridge 地址:
Begin your L2 adventures by depositing some L1 Kurtosis ETH to: 0xb398266ae3269a1eb57346870abfcbf71b5097a9


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
op-deployer 部署合约时，如下错误时合约版本不一致导致的。

下面错误是在本地而不是 kurtosis运行 op-deployer时报的错，可能是由于 本地的bedrock-contracts 版本与 kurtosis 里使用的不一致
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
5. op-batcher 由于 blobGasFee 为 nil 导致 panic，设置为 nil 则返回1，log见[op-batch panic]
6. 默认op-batcher发送 batch 到 l1 时为 blob 交易，修改 `network_params.yaml`中 op-batcher 启动参数配置`--data-availability-type=calldata`
7. op-batcher 发送 calldata 交易到 l1 时 gas 计算为 `op-geth/core/state_transition.go FloorDataGas`， 计算结果小于 conflux 链实际需要，修改为 2 倍解决。(optimize 的 go.mod 需要设置 replace 再 build)
8. op-challenger 用到了 batch rpc，适配 rpc proxy 解决中



# kurtosis 常用命令
```sh
# 查看所有错误日志
kurtosis service logs -f -a op-cfx | grep error
```

# 涉及的 log

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