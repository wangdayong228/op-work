#!/bin/bash
# 使用前需要先确定kurtosis 部署时使用的op-deployer版本，如当前使用的是 op-deployer/v0.0.12
# 安装op-deployer:  git checkout tags/op-deployer/v0.0.12  &&  go install ./op-deployer/cmd/op-deployer
# 下载op-deployer-configs:  kurtosis files download op-cfx op-deployer-configs ./dist/op-deployer-configs-cfx
mkdir -p ./dist/inspect
op-deployer inspect l1 --workdir ./dist/op-deployer-configs 2151908 > ./dist/inspect/l1.json        
op-deployer inspect l2-semvers --workdir ./dist/op-deployer-configs 2151908 > ./dist/inspect/l2-semvers.json
op-deployer inspect deploy-config --workdir ./dist/op-deployer-configs 2151908 > ./dist/inspect/deploy-config.json
op-deployer inspect rollup --workdir ./dist/op-deployer-configs 2151908 > ./dist/inspect/rollup.json
op-deployer inspect genesis --workdir ./dist/op-deployer-configs 2151908 > ./dist/inspect/genesis.json