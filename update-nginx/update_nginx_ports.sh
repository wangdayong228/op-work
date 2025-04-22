#!/bin/bash

# 设置错误时退出
set -e

# 处理命令行参数 - 只接受一个参数作为 ENCLAVE_NAME
if [ $# -eq 1 ]; then
  ENCLAVE_NAME="$1"
else
  ENCLAVE_NAME="op-cfx"  # 默认值
fi

echo "使用 Enclave: $ENCLAVE_NAME"

# 从模板文件读取内容
TEMPLATE_FILE="${ENCLAVE_NAME}.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "错误：模板文件 $TEMPLATE_FILE 不存在！"
  exit 1
fi

# 读取模板文件内容
template=$(cat "$TEMPLATE_FILE")
echo "已加载模板文件: $TEMPLATE_FILE"

# 获取 kurtosis 中服务的 HTTP 端口
GRAFANA_PORT=$(kurtosis port print ${ENCLAVE_NAME} grafana http)
PROMETHEUS_PORT=$(kurtosis port print ${ENCLAVE_NAME} prometheus http)
BLOCKSCOUT_PORT=$(kurtosis port print ${ENCLAVE_NAME} op-blockscoutop-kurtosis http)
L1_RPC_PORT="http://127.0.0.1:3031"
L2_OP_GETH_RPC_PORT=$(kurtosis port print ${ENCLAVE_NAME} op-el-1-op-geth-op-node-op-kurtosis rpc)
L2_OP_NODE_RPC_PORT=$(kurtosis port print ${ENCLAVE_NAME} op-cl-1-op-node-op-geth-op-kurtosis http)

# 替换模板中的变量
output=$(echo "$template" | sed "s|{{l1_rpc_port}}|$L1_RPC_PORT|g" \
                          | sed "s|{{l2_op_geth_rpc_port}}|$L2_OP_GETH_RPC_PORT|g" \
                          | sed "s|{{l2_op_node_rpc_port}}|$L2_OP_NODE_RPC_PORT|g" \
                          | sed "s|{{grafana_port}}|$GRAFANA_PORT|g" \
                          | sed "s|{{prometheus_port}}|$PROMETHEUS_PORT|g" \
                          | sed "s|{{blockscout_port}}|$BLOCKSCOUT_PORT|g")

# 输出替换后的结果
echo "生成的Nginx配置如下:"
echo "----------------------------------------"
echo "$output"
echo "----------------------------------------"

# 交互式询问是否接受
read -p "是否接受此配置并写入到/etc/nginx/sites-available/${ENCLAVE_NAME}-ports? (y/n): " answer

# 转换为小写以便于处理
answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

if [[ "$answer" == "y" || "$answer" == "yes" ]]; then
    # 写入文件
    CONFIG_FILE="/etc/nginx/sites-available/${ENCLAVE_NAME}-ports"
    echo "$output" | sudo tee "$CONFIG_FILE" > /dev/null
    if [ $? -eq 0 ]; then
        echo "配置已成功写入到 $CONFIG_FILE"
        
        # 创建符号链接到 sites-enabled 目录
        LINK_FILE="/etc/nginx/sites-enabled/${ENCLAVE_NAME}-ports"
        if [ ! -L "$LINK_FILE" ]; then
            echo "创建符号链接到 sites-enabled 目录..."
            sudo ln -s "$CONFIG_FILE" "$LINK_FILE" || echo "创建符号链接失败，请手动执行: sudo ln -s $CONFIG_FILE $LINK_FILE"
        fi
        
        echo "提示：正在测试和重新加载Nginx配置..."
        nginx -t  # 测试配置
        nginx -s reload  # 重新加载Nginx
        echo "Nginx配置重启完成！"
    else
        echo "写入配置文件失败，请检查权限"
        exit 1
    fi
else
    echo "操作已取消，未写入配置文件"
fi