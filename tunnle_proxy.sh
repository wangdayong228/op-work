#!/bin/bash
set -x
# source .profile
YIDAIYILU_SERVER=8.218.255.183

trap "trap - SIGTERM && kill 0" SIGINT SIGTERM EXIT
autossh -M 0 -vvv -CN -p 22 -L 21000:127.0.0.1:21000 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 21001:127.0.0.1:21001 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 22002:127.0.0.1:22002 root@$YIDAIYILU_SERVER