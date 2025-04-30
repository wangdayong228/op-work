# 说明

该 demo 演示了 l2->l1 跨链的关键步骤。

## 步骤
1. start_withdraw.ts 发起 l2->l1 跨链ETH；会输出交易hash。 `ts-node ./start_withdraw.ts   `
2. prove_and_finish.ts 上传证明到 l1 并提现。 `ts-node ./prove_and_finish.ts 0xe50cbcbc28c2fcfa3ca09c5d5cd937e8da149371962f1001ab51175c42f064b2`