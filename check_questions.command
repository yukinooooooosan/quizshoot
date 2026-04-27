#!/bin/bash
cd "$(dirname "$0")"
node check_questions.mjs
echo ""
echo "Press Enter to close..."
read
