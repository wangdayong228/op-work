if kurtosis enclave ls | grep -q "op-cfx"; then
    kurtosis enclave rm -f op-cfx
fi
kurtosis run --cli-log-level debug -v EXECUTABLE --enclave op-cfx ../ --args-file ./network_params_cfx.yaml 2>&1 > ./deploy-cfx.log


