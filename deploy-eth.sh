if kurtosis enclave ls | grep -q "op-eth"; then
    kurtosis enclave rm -f op-eth
fi
kurtosis run --cli-log-level debug -v EXECUTABLE --enclave op-eth ../ --args-file ./network_params_eth.yaml 2>&1 > ./deploy-eth.log


