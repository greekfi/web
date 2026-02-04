#!/bin/bash
# Wrapper for yarn that handles legacy v1 commands for Next.js compatibility

# If the command is "config get registry", return the npm registry
if [ "$1" = "config" ] && [ "$2" = "get" ] && [ "$3" = "registry" ]; then
  echo "https://registry.npmjs.org"
  exit 0
fi

# Otherwise, pass through to the actual yarn
exec "$(dirname "$0")/../.yarn/releases/yarn-4.12.0.cjs" "$@"
