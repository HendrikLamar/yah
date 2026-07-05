#!/usr/bin/env bash
# ssh-deploy-wrapper.sh — validating SSH forced command for the yah CI deploy key.
# Installed once during server setup to /opt/yah/bin/ (root-owned 755). The bin
# dir is root-owned and OUTSIDE the CI rsync targets, so CI can never replace
# this file even though the rsync rule below permits paths under /opt/yah/.
set -euo pipefail

LOG=/opt/yah/deploy.log
ORIG="${SSH_ORIGINAL_COMMAND:-}"

reject() {
    printf '%s rejected SSH command: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ORIG" >> "$LOG" 2>/dev/null \
        || logger -t ssh-deploy-wrapper "rejected SSH command: $ORIG" 2>/dev/null || true
    echo "ssh-deploy-wrapper: command not permitted" >&2
    exit 1
}

# 1) rsync server side. Pattern: `rsync --server … <path>`. Two rules,
#    hardened over the naive prefix check:
#    - option tokens must be plain clusters/names (no `=` payload, no slash):
#      blocks path-smuggling flags like --files-from=/etc/… or --temp-dir=/…
#      (a separate-token flag argument falls through to the path rule below)
#    - every path argument must CANONICALIZE (realpath -m) to /opt/yah/…:
#      blocks /opt/yah/../../home/igor/.ssh traversal
if [[ "$ORIG" == rsync\ --server\ * ]]; then
    ok=1
    for tok in $ORIG; do
        case "$tok" in
            rsync|.) continue ;;
            -*)
                [[ "$tok" =~ ^--?[a-zA-Z0-9.-]+$ ]] || ok=0
                ;;
            *)
                real="$(realpath -m -- "$tok" 2>/dev/null || echo /invalid)"
                case "$real" in
                    /opt/yah|/opt/yah/*) : ;;
                    *) ok=0 ;;
                esac
                ;;
        esac
    done
    if [ "$ok" -eq 1 ]; then
        exec $ORIG
    fi
    reject
fi

# 2) Deploy invocation: exactly `IMAGE_TAG=<hex> /opt/yah/scripts/deploy.sh`.
if [[ "$ORIG" =~ ^IMAGE_TAG=([0-9a-f]{7,40})\ /opt/yah/scripts/deploy\.sh$ ]]; then
    export IMAGE_TAG="${BASH_REMATCH[1]}"
    exec bash /opt/yah/scripts/deploy.sh
fi

# 3) Anything else.
reject
