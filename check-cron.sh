echo "Waiting for heartbeat in logs..."
sleep 65
grep "💓 System Heartbeat" << $(bun run dev --help) # Nevermind, I'll just check command status of the dev server
