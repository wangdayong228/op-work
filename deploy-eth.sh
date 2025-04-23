if kurtosis enclave ls | grep -q "op-eth"; then
    kurtosis enclave rm -f op-eth
fi
kurtosis run --cli-log-level debug -v EXECUTABLE --enclave op-eth ../optimism-package --args-file ./network_params_eth.yaml 2>&1 > ./deploy-eth.log

echo "部署完成，请手动在 l1 和 l2 充 1000eth 到 0x180F2613c52c903A0d79B8025D8B14e461b22eF1"