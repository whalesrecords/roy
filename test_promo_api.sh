#!/bin/bash

# Test promo API endpoint

API_URL="${1:-http://localhost:8000}"
ADMIN_TOKEN="${2:-dev-admin-token}"

echo "Testing promo API at: $API_URL"
echo "Admin token: $ADMIN_TOKEN"
echo ""

# Test health endpoint
echo "1. Testing /health endpoint..."
curl -s "$API_URL/health" | jq . || echo "Health check failed"
echo ""

# Test promo stats endpoint
echo "2. Testing /promo/stats endpoint..."
curl -s -H "X-Admin-Token: $ADMIN_TOKEN" "$API_URL/promo/stats" | jq . || echo "Promo stats failed"
echo ""

# Test promo submissions endpoint
echo "3. Testing /promo/submissions endpoint..."
curl -s -H "X-Admin-Token: $ADMIN_TOKEN" "$API_URL/promo/submissions" | jq . || echo "Promo submissions failed"
echo ""

# Test analyze endpoint with a dummy file
echo "4. Testing /promo/import/submithub/analyze endpoint..."
echo "song,outlet,action" > /tmp/test.csv
echo "Test Song,Test Outlet,listen" >> /tmp/test.csv

curl -s -X POST \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -F "file=@/tmp/test.csv" \
  "$API_URL/promo/import/submithub/analyze" | jq . || echo "Analyze failed"

rm /tmp/test.csv
echo ""

echo "Done!"
