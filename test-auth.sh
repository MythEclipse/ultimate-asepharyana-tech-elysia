#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="${API_URL:-http://localhost:4092}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Global variables for tokens and IDs
ACCESS_TOKEN=""
REFRESH_TOKEN=""
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_USERNAME="testuser_$(date +%s)"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $message"
        ((PASSED_TESTS++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC}: $message"
        ((FAILED_TESTS++))
    elif [ "$status" = "INFO" ]; then
        echo -e "${BLUE}ℹ INFO${NC}: $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC}: $message"
    fi
    ((TOTAL_TESTS++))
}

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  ElysiaJS Auth Testing Script  ${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo -e "${BLUE}Test Email: $TEST_EMAIL${NC}"
echo ""

# 1. Health Check
echo -e "${YELLOW}=== Health Check ===${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
if [ "$HTTP_CODE" = "200" ]; then
    print_status "PASS" "Health check endpoint (HTTP $HTTP_CODE)"
else
    print_status "FAIL" "Health check endpoint (Got: $HTTP_CODE)"
fi

# 2. Registration
echo -e "\n${YELLOW}=== Registration ===${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"name\": \"Test User\",
        \"username\": \"$TEST_USERNAME\"
    }")

if echo "$REGISTER_RESPONSE" | grep -q "user"; then
    print_status "PASS" "User registration"
else
    print_status "FAIL" "User registration"
    echo "Response: $REGISTER_RESPONSE"
fi

# 3. Login
echo -e "\n${YELLOW}=== Login ===${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    print_status "PASS" "User login"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
else
    print_status "FAIL" "User login"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# 4. Get current user info
echo -e "\n${YELLOW}=== User Profile ===${NC}"
ME_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$ME_RESPONSE" | grep -q "\"email\":\"$TEST_EMAIL\""; then
    print_status "PASS" "Get current user info"
else
    print_status "FAIL" "Get current user info"
    echo "Response: $ME_RESPONSE"
fi

# 5. Logout
echo -e "\n${YELLOW}=== Logout ===${NC}"
LOGOUT_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/logout" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if [ "$LOGOUT_HTTP_CODE" = "200" ]; then
    print_status "PASS" "User logout (HTTP $LOGOUT_HTTP_CODE)"
else
    print_status "FAIL" "User logout (Got: $LOGOUT_HTTP_CODE)"
fi

# Summary
echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}      Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✓ All auth tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed!${NC}"
    exit 1
fi
