#!/bin/bash
set -x
# source .profile
YIDAIYILU_SERVER=47.83.15.87

trap "trap - SIGTERM && kill 0" SIGINT SIGTERM EXIT
autossh -M 0 -vvv -CN -p 22 -L 22000:127.0.0.1:22000 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 22001:127.0.0.1:22001 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 22002:127.0.0.1:22002 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 22100:127.0.0.1:22100 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 22200:127.0.0.1:22200 root@$YIDAIYILU_SERVER &
autossh -M 0 -vvv -CN -p 22 -L 22300:127.0.0.1:22300 root@$YIDAIYILU_SERVER