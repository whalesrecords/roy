#!/bin/bash
echo "Testing notifications API endpoint..."
echo ""
curl -s -H "X-Admin-Token: dev-admin-token" http://localhost:8000/artist-portal/notifications | python3 -m json.tool | head -50
